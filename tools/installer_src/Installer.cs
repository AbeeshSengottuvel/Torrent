using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace HavenInstaller
{
    static class NativeMethods
    {
        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HT_CAPTION = 0x2;

        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);

        public const uint SHCNE_ASSOCCHANGED = 0x08000000;
        public const uint SHCNF_IDLIST = 0x0000;

        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();
    }

    public class InstallerForm : Form
    {
        // Color Palette - Haven Dark Obsidian & Emerald
        private static readonly Color BgColor = Color.FromArgb(11, 15, 20);
        private static readonly Color CardBg = Color.FromArgb(18, 26, 34);
        private static readonly Color BorderColor = Color.FromArgb(32, 45, 59);
        private static readonly Color AccentEmerald = Color.FromArgb(16, 185, 129);
        private static readonly Color AccentHover = Color.FromArgb(5, 150, 105);
        private static readonly Color TextPrimary = Color.FromArgb(243, 244, 246);
        private static readonly Color TextSecondary = Color.FromArgb(156, 163, 175);
        private static readonly Color TextDim = Color.FromArgb(107, 114, 128);

        // Stages: 0 = Options, 1 = Progress, 2 = Complete
        private int currentStage = 0;

        // Options
        private CheckBox chkDesktop;
        private CheckBox chkStartMenu;
        private CheckBox chkProtocols;
        private CheckBox chkLaunchAfter;

        // Custom Buttons & Progress
        private Button btnInstall;
        private Button btnClose;
        private Label lblStatus;
        private Label lblPercentage;
        private int progressValue = 0;
        private System.Windows.Forms.Timer animTimer;
        private int targetProgress = 0;

        private string installDir;
        private Thread workerThread;

        public InstallerForm()
        {
            try { NativeMethods.SetProcessDPIAware(); } catch { }

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            installDir = Path.Combine(localAppData, "Programs", "Haven");

            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Size = new Size(540, 430);
            this.BackColor = BgColor;
            this.DoubleBuffered = true;
            this.ShowInTaskbar = true;
            this.Text = "Haven Setup";

            BuildUI();

            animTimer = new System.Windows.Forms.Timer();
            animTimer.Interval = 20;
            animTimer.Tick += (s, e) =>
            {
                if (progressValue < targetProgress)
                {
                    progressValue += Math.Max(1, (targetProgress - progressValue) / 4);
                    if (progressValue > 100) progressValue = 100;
                    this.Invalidate();
                }
            };
            animTimer.Start();
        }

        private void BuildUI()
        {
            // Close Button
            btnClose = new Button();
            btnClose.Text = "×";
            btnClose.Font = new Font("Segoe UI", 14, FontStyle.Regular);
            btnClose.ForeColor = TextSecondary;
            btnClose.BackColor = Color.Transparent;
            btnClose.FlatStyle = FlatStyle.Flat;
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.FlatAppearance.MouseOverBackColor = Color.FromArgb(40, 239, 68, 68);
            btnClose.Size = new Size(36, 32);
            btnClose.Location = new Point(this.Width - 44, 8);
            btnClose.Cursor = Cursors.Hand;
            btnClose.Click += (s, e) => this.Close();
            this.Controls.Add(btnClose);

            // Primary Action Button (Install / Launch)
            btnInstall = new Button();
            btnInstall.Text = "Install Haven";
            btnInstall.Font = new Font("Segoe UI", 11, FontStyle.Bold);
            btnInstall.ForeColor = Color.White;
            btnInstall.BackColor = AccentEmerald;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Size = new Size(460, 46);
            btnInstall.Location = new Point(40, 350);
            btnInstall.Cursor = Cursors.Hand;
            btnInstall.Click += BtnInstall_Click;
            btnInstall.Paint += (s, e) =>
            {
                // Smooth rounded corners for button
                Graphics g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath path = GetRoundedRect(new Rectangle(0, 0, btnInstall.Width, btnInstall.Height), 8))
                {
                    btnInstall.Region = new Region(path);
                }
            };
            this.Controls.Add(btnInstall);

            // Options Checkboxes
            chkDesktop = CreateStyledCheckbox("Create Desktop shortcut", 215, true);
            chkStartMenu = CreateStyledCheckbox("Create Start Menu shortcut", 245, true);
            chkProtocols = CreateStyledCheckbox("Associate .torrent and magnet: protocols", 275, true);
            chkLaunchAfter = CreateStyledCheckbox("Launch Haven after installation finishes", 305, true);

            this.Controls.Add(chkDesktop);
            this.Controls.Add(chkStartMenu);
            this.Controls.Add(chkProtocols);
            this.Controls.Add(chkLaunchAfter);

            // Status Labels for Progress Stage
            lblStatus = new Label();
            lblStatus.Text = "Preparing installation...";
            lblStatus.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            lblStatus.ForeColor = TextSecondary;
            lblStatus.Location = new Point(40, 240);
            lblStatus.Size = new Size(380, 22);
            lblStatus.Visible = false;
            this.Controls.Add(lblStatus);

            lblPercentage = new Label();
            lblPercentage.Text = "0%";
            lblPercentage.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblPercentage.ForeColor = AccentEmerald;
            lblPercentage.Location = new Point(430, 240);
            lblPercentage.Size = new Size(70, 22);
            lblPercentage.TextAlign = ContentAlignment.TopRight;
            lblPercentage.Visible = false;
            this.Controls.Add(lblPercentage);
        }

        private CheckBox CreateStyledCheckbox(string text, int top, bool isChecked)
        {
            CheckBox cb = new CheckBox();
            cb.Text = "  " + text;
            cb.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            cb.ForeColor = TextPrimary;
            cb.BackColor = Color.Transparent;
            cb.Checked = isChecked;
            cb.Location = new Point(44, top);
            cb.Size = new Size(450, 24);
            cb.Cursor = Cursors.Hand;
            return cb;
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            if (currentStage == 0)
            {
                // Switch to Progress Stage
                currentStage = 1;
                chkDesktop.Visible = false;
                chkStartMenu.Visible = false;
                chkProtocols.Visible = false;
                chkLaunchAfter.Visible = false;
                btnInstall.Enabled = false;
                btnInstall.Text = "Installing...";
                btnInstall.BackColor = Color.FromArgb(20, 30, 40);
                lblStatus.Visible = true;
                lblPercentage.Visible = true;
                this.Invalidate();

                workerThread = new Thread(PerformInstallation);
                workerThread.IsBackground = true;
                workerThread.Start();
            }
            else if (currentStage == 2)
            {
                // Completion Stage -> Launch or Close
                LaunchInstalledApp();
                this.Close();
            }
        }

        private void SetStatus(string message, int percent)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => SetStatus(message, percent)));
                return;
            }
            lblStatus.Text = message;
            targetProgress = Math.Min(100, Math.Max(0, percent));
            lblPercentage.Text = targetProgress + "%";
            this.Invalidate();
        }

        private void PerformInstallation()
        {
            try
            {
                SetStatus("Closing running Haven instances...", 5);
                KillRunningProcesses("Haven");

                SetStatus("Preparing application directory...", 10);
                if (!Directory.Exists(installDir))
                {
                    Directory.CreateDirectory(installDir);
                }

                // Locate payload: Embedded Resource > Adjacent ZIP > Adjacent Directory
                Stream zipStream = null;
                Assembly asm = Assembly.GetExecutingAssembly();
                string[] resNames = asm.GetManifestResourceNames();
                foreach (string name in resNames)
                {
                    if (name.IndexOf("HavenPayload", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        name.IndexOf("payload", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        zipStream = asm.GetManifestResourceStream(name);
                        break;
                    }
                }

                string currentDir = AppDomain.CurrentDomain.BaseDirectory;
                string adjacentZip = Path.Combine(currentDir, "Haven-1.0.0-win-x64-portable.zip");
                if (zipStream == null && !File.Exists(adjacentZip))
                {
                    adjacentZip = Path.Combine(currentDir, "payload.zip");
                }

                if (zipStream != null)
                {
                    SetStatus("Extracting self-contained package...", 20);
                    ExtractZipStream(zipStream);
                }
                else if (File.Exists(adjacentZip))
                {
                    SetStatus("Extracting Haven archive...", 20);
                    using (FileStream fs = File.OpenRead(adjacentZip))
                    {
                        ExtractZipStream(fs);
                    }
                }
                else
                {
                    // Check local source directory in current folder or adjacent folders
                    string sourceDir = Path.Combine(currentDir, "Haven-win32-x64");
                    if (!Directory.Exists(sourceDir))
                    {
                        sourceDir = Path.Combine(currentDir, "..", "desktop", "dist", "Haven-win32-x64");
                    }
                    if (!Directory.Exists(sourceDir))
                    {
                        sourceDir = Path.Combine(currentDir, "dist", "Haven-win32-x64");
                    }

                    if (Directory.Exists(sourceDir))
                    {
                        SetStatus("Copying application binaries...", 20);
                        CopyDirectoryWithProgress(sourceDir, installDir);
                    }
                    else
                    {
                        // Standalone Web-Installer: Stream genuine components from site CDN
                        string tempZip = Path.Combine(Path.GetTempPath(), "Haven-Payload-" + Guid.NewGuid().ToString("N").Substring(0, 6) + ".zip");
                        string[] chunkNames = new string[] { "haven-core.001", "haven-core.002", "haven-core.003" };
                        string cdnBase = "https://abeeshsengottuvel.github.io/Torrent/downloads/";
                        string rawBase = "https://raw.githubusercontent.com/AbeeshSengottuvel/Torrent/main/site/downloads/";

                        try
                        {
                            using (FileStream outFs = new FileStream(tempZip, FileMode.Create, FileAccess.Write, FileShare.None))
                            {
                                for (int i = 0; i < chunkNames.Length; i++)
                                {
                                    int basePct = 15 + (int)(i * (60.0 / chunkNames.Length));
                                    SetStatus(string.Format("Streaming components ({0}/{1})...", i + 1, chunkNames.Length), basePct);
                                    byte[] chunkData = DownloadChunkBytes(cdnBase + chunkNames[i], rawBase + chunkNames[i]);
                                    outFs.Write(chunkData, 0, chunkData.Length);
                                }
                            }

                            SetStatus("Extracting Haven package...", 80);
                            using (FileStream fs = File.OpenRead(tempZip))
                            {
                                ExtractZipStream(fs);
                            }
                            try { File.Delete(tempZip); } catch { }
                        }
                        catch (Exception streamEx)
                        {
                            bool resolved = false;
                            this.Invoke(new Action(() =>
                            {
                                DialogResult dr = MessageBox.Show(this,
                                    "Could not download components automatically:\n" + streamEx.Message + "\n\n" +
                                    "Would you like to browse for a local Haven portable package (.zip)?",
                                    "Haven Setup",
                                    MessageBoxButtons.YesNo,
                                    MessageBoxIcon.Question);

                                if (dr == DialogResult.Yes)
                                {
                                    using (OpenFileDialog ofd = new OpenFileDialog())
                                    {
                                        ofd.Title = "Select Haven Portable Package";
                                        ofd.Filter = "Haven Package (*.zip)|*.zip|All Files (*.*)|*.*";
                                        if (ofd.ShowDialog(this) == DialogResult.OK && File.Exists(ofd.FileName))
                                        {
                                            SetStatus("Extracting selected package...", 75);
                                            using (FileStream fs = File.OpenRead(ofd.FileName))
                                            {
                                                ExtractZipStream(fs);
                                            }
                                            resolved = true;
                                        }
                                    }
                                }
                            }));

                            if (!resolved)
                            {
                                throw new InvalidOperationException("Installation aborted: Package files could not be retrieved.");
                            }
                        }
                    }
                }

                string mainExe = Path.Combine(installDir, "Haven.exe");
                if (!File.Exists(mainExe))
                {
                    string subExe = Path.Combine(installDir, "Haven-win32-x64", "Haven.exe");
                    if (File.Exists(subExe))
                    {
                        mainExe = subExe;
                        installDir = Path.Combine(installDir, "Haven-win32-x64");
                    }
                }

                SetStatus("Configuring system shortcuts...", 85);
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string startMenuDir = Path.Combine(appData, "Microsoft", "Windows", "Start Menu", "Programs");
                string startMenuShortcut = Path.Combine(startMenuDir, "Haven.lnk");

                if (chkStartMenu.Checked)
                {
                    CreateShortcut(startMenuShortcut, mainExe, installDir, "Haven - Secure BitTorrent Client");
                }

                if (chkDesktop.Checked)
                {
                    string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    string desktopShortcut = Path.Combine(desktopDir, "Haven.lnk");
                    CreateShortcut(desktopShortcut, mainExe, installDir, "Haven - Secure BitTorrent Client");
                }

                if (chkProtocols.Checked)
                {
                    SetStatus("Registering .torrent and magnet: protocols...", 90);
                    RegisterProtocols(mainExe);
                }

                SetStatus("Registering Windows uninstaller...", 95);
                string uninstallExe = Path.Combine(installDir, "Haven-Uninstall.exe");
                RegisterUninstaller(mainExe, uninstallExe, installDir);

                SetStatus("Installation complete.", 100);
                Thread.Sleep(400);

                this.BeginInvoke(new Action(() =>
                {
                    currentStage = 2;
                    lblStatus.Visible = false;
                    lblPercentage.Visible = false;
                    btnInstall.Enabled = true;
                    btnInstall.Text = "Launch Haven";
                    btnInstall.BackColor = AccentEmerald;
                    this.Invalidate();

                    if (chkLaunchAfter.Checked)
                    {
                        LaunchInstalledApp();
                        this.Close();
                    }
                }));
            }
            catch (Exception ex)
            {
                this.BeginInvoke(new Action(() =>
                {
                    MessageBox.Show(this, "Installation encountered an issue:\n\n" + ex.Message, "Haven Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    this.Close();
                }));
            }
        }

        private byte[] DownloadChunkBytes(string cdnUrl, string rawUrl)
        {
            using (System.Net.WebClient wc = new System.Net.WebClient())
            {
                System.Net.ServicePointManager.SecurityProtocol = (System.Net.SecurityProtocolType)3072;
                wc.Headers.Add("User-Agent", "Haven-Installer/1.0.0");

                try
                {
                    return wc.DownloadData(cdnUrl);
                }
                catch
                {
                    return wc.DownloadData(rawUrl);
                }
            }
        }

        private void DownloadPayloadWithProgress(string url, string destPath)
        {
            using (System.Net.WebClient wc = new System.Net.WebClient())
            {
                System.Net.ServicePointManager.SecurityProtocol = (System.Net.SecurityProtocolType)3072;
                wc.Headers.Add("User-Agent", "Haven-Installer/1.0.0");

                AutoResetEvent done = new AutoResetEvent(false);
                Exception dlError = null;

                wc.DownloadProgressChanged += (s, e) =>
                {
                    int pct = 15 + (int)((e.ProgressPercentage / 100f) * 60);
                    double receivedMb = e.BytesReceived / (1024.0 * 1024.0);
                    double totalMb = e.TotalBytesToReceive / (1024.0 * 1024.0);
                    if (totalMb > 0)
                    {
                        SetStatus(string.Format("Downloading Haven ({0:0.0} / {1:0.0} MB)...", receivedMb, totalMb), pct);
                    }
                    else
                    {
                        SetStatus(string.Format("Downloading Haven ({0:0.0} MB)...", receivedMb), pct);
                    }
                };

                wc.DownloadFileCompleted += (s, e) =>
                {
                    if (e.Error != null) dlError = e.Error;
                    done.Set();
                };

                wc.DownloadFileAsync(new Uri(url), destPath);
                done.WaitOne();

                if (dlError != null)
                {
                    throw new Exception("Unable to download Haven package automatically: " + dlError.Message + "\n\nYou can also download Haven-1.0.0-win-x64-portable.zip or run Haven-Setup.bat.");
                }
            }
        }

        private void ExtractZipStream(Stream stream)
        {
            using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                int total = archive.Entries.Count;
                int current = 0;
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    current++;
                    int pct = 20 + (int)((current / (float)total) * 60);
                    string destPath = Path.Combine(installDir, entry.FullName);
                    string destDir = Path.GetDirectoryName(destPath);
                    if (!string.IsNullOrEmpty(destDir) && !Directory.Exists(destDir))
                    {
                        Directory.CreateDirectory(destDir);
                    }
                    if (!string.IsNullOrEmpty(entry.Name))
                    {
                        entry.ExtractToFile(destPath, true);
                    }
                    if (current % 5 == 0 || current == total)
                    {
                        SetStatus(string.Format("Extracting ({0}/{1}): {2}", current, total, entry.Name), pct);
                    }
                }
            }
        }

        private void CopyDirectoryWithProgress(string sourceDir, string targetDir)
        {
            string[] files = Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories);
            int total = files.Length;
            int current = 0;

            foreach (string dir in Directory.GetDirectories(sourceDir, "*", SearchOption.AllDirectories))
            {
                string rel = dir.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar);
                Directory.CreateDirectory(Path.Combine(targetDir, rel));
            }

            foreach (string file in files)
            {
                current++;
                int pct = 20 + (int)((current / (float)total) * 60);
                string rel = file.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar);
                File.Copy(file, Path.Combine(targetDir, rel), true);
                if (current % 5 == 0 || current == total)
                {
                    SetStatus(string.Format("Copying ({0}/{1}): {2}", current, total, Path.GetFileName(file)), pct);
                }
            }
        }

        private void KillRunningProcesses(string procName)
        {
            try
            {
                Process[] procs = Process.GetProcessesByName(procName);
                foreach (Process p in procs)
                {
                    try
                    {
                        p.CloseMainWindow();
                        if (!p.WaitForExit(1500))
                        {
                            p.Kill();
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }

        public static void RegisterProtocols(string mainExe)
        {
            try
            {
                // 1. magnet: protocol handler
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\magnet"))
                {
                    if (key != null)
                    {
                        key.SetValue("", "URL:BitTorrent Magnet Link");
                        key.SetValue("URL Protocol", "");
                        using (RegistryKey icon = key.CreateSubKey("DefaultIcon"))
                        {
                            if (icon != null) icon.SetValue("", "\"" + mainExe + "\",0");
                        }
                        using (RegistryKey cmd = key.CreateSubKey(@"shell\open\command"))
                        {
                            if (cmd != null) cmd.SetValue("", "\"" + mainExe + "\" \"%1\"");
                        }
                    }
                }

                // 2. .torrent file association
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\.torrent"))
                {
                    if (key != null)
                    {
                        key.SetValue("", "Haven.Torrent");
                    }
                }

                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\Haven.Torrent"))
                {
                    if (key != null)
                    {
                        key.SetValue("", "BitTorrent File");
                        using (RegistryKey icon = key.CreateSubKey("DefaultIcon"))
                        {
                            if (icon != null) icon.SetValue("", "\"" + mainExe + "\",0");
                        }
                        using (RegistryKey cmd = key.CreateSubKey(@"shell\open\command"))
                        {
                            if (cmd != null) cmd.SetValue("", "\"" + mainExe + "\" \"%1\"");
                        }
                    }
                }

                NativeMethods.SHChangeNotify(NativeMethods.SHCNE_ASSOCCHANGED, NativeMethods.SHCNF_IDLIST, IntPtr.Zero, IntPtr.Zero);
            }
            catch { }
        }

        public static void RegisterUninstaller(string mainExe, string uninstallExe, string targetDir)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "Haven");
                        key.SetValue("DisplayVersion", "1.0.0");
                        key.SetValue("Publisher", "Haven Contributors");
                        key.SetValue("InstallLocation", targetDir);
                        key.SetValue("UninstallString", "\"" + uninstallExe + "\"");
                        key.SetValue("QuietUninstallString", "\"" + uninstallExe + "\" --silent");
                        key.SetValue("DisplayIcon", "\"" + mainExe + "\",0");
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                        key.SetValue("EstimatedSize", 280000, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }

        public static void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = workingDir;
                    shortcut.Description = description;
                    shortcut.IconLocation = targetPath + ",0";
                    shortcut.Save();
                }
            }
            catch { }
        }

        private void LaunchInstalledApp()
        {
            try
            {
                string mainExe = Path.Combine(installDir, "Haven.exe");
                if (File.Exists(mainExe))
                {
                    Process.Start(new ProcessStartInfo(mainExe) { WorkingDirectory = installDir });
                }
            }
            catch { }
        }

        // Custom Painting & Window Dragging
        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button == MouseButtons.Left && e.Y < 80)
            {
                NativeMethods.ReleaseCapture();
                NativeMethods.SendMessage(this.Handle, NativeMethods.WM_NCLBUTTONDOWN, NativeMethods.HT_CAPTION, 0);
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            // 1. Draw Outer Border & Background
            using (GraphicsPath outerPath = GetRoundedRect(new Rectangle(0, 0, this.Width - 1, this.Height - 1), 12))
            {
                using (Pen p = new Pen(BorderColor, 1.5f))
                {
                    g.DrawPath(p, outerPath);
                }
            }

            // 2. Draw Hero Header (Icon + App Title)
            // Emerald Accent Badge Icon
            Rectangle iconRect = new Rectangle(40, 36, 44, 44);
            using (GraphicsPath iconPath = GetRoundedRect(iconRect, 10))
            {
                using (LinearGradientBrush lgb = new LinearGradientBrush(iconRect, Color.FromArgb(16, 185, 129), Color.FromArgb(5, 150, 105), 45f))
                {
                    g.FillPath(lgb, iconPath);
                }
            }

            // Draw Mountain / Sanctuary Symbol inside icon
            using (Pen symPen = new Pen(Color.White, 2.5f))
            {
                symPen.StartCap = LineCap.Round;
                symPen.EndCap = LineCap.Round;
                g.DrawLine(symPen, 50, 64, 62, 48);
                g.DrawLine(symPen, 62, 48, 74, 64);
                g.DrawLine(symPen, 60, 64, 67, 56);
                g.DrawLine(symPen, 67, 56, 74, 64);
            }

            // Header Typography
            using (Font titleFont = new Font("Segoe UI", 18, FontStyle.Bold))
            using (SolidBrush b = new SolidBrush(TextPrimary))
            {
                g.DrawString("Haven", titleFont, b, 96, 32);
            }

            using (Font subFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
            using (SolidBrush b = new SolidBrush(TextSecondary))
            {
                g.DrawString("Version 1.0.0 • Secure BitTorrent Client", subFont, b, 98, 58);
            }

            // Header Tagline Badge
            Rectangle badgeRect = new Rectangle(40, 94, 460, 26);
            using (GraphicsPath bp = GetRoundedRect(badgeRect, 6))
            {
                using (SolidBrush bb = new SolidBrush(Color.FromArgb(15, 23, 30)))
                {
                    g.FillPath(bb, bp);
                }
                using (Pen bpPen = new Pen(Color.FromArgb(28, 40, 54), 1f))
                {
                    g.DrawPath(bpPen, bp);
                }
            }

            using (Font badgeFont = new Font("Segoe UI", 8.5f, FontStyle.Regular))
            using (SolidBrush b = new SolidBrush(Color.FromArgb(52, 211, 153)))
            {
                g.DrawString("✦  ZERO ADS  ·  NO TELEMETRY  ·  PER-USER ISOLATION", badgeFont, b, 50, 99);
            }

            // 3. Stage Content
            if (currentStage == 0)
            {
                // Folder Location Card
                Rectangle pathCard = new Rectangle(40, 134, 460, 60);
                using (GraphicsPath pcp = GetRoundedRect(pathCard, 8))
                {
                    using (SolidBrush b = new SolidBrush(CardBg))
                    {
                        g.FillPath(b, pcp);
                    }
                    using (Pen p = new Pen(BorderColor, 1f))
                    {
                        g.DrawPath(p, pcp);
                    }
                }

                using (Font lblFont = new Font("Segoe UI", 8f, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(TextDim))
                {
                    g.DrawString("INSTALLATION DESTINATION (NO ADMIN REQUIRED)", lblFont, b, 54, 144);
                }

                using (Font pathFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextPrimary))
                {
                    g.DrawString(installDir, pathFont, b, 54, 163);
                }
            }
            else if (currentStage == 1)
            {
                // Progress Bar
                Rectangle trackRect = new Rectangle(40, 268, 460, 10);
                using (GraphicsPath tp = GetRoundedRect(trackRect, 5))
                {
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(24, 34, 46)))
                    {
                        g.FillPath(b, tp);
                    }
                }

                int fillWidth = Math.Max(10, (int)(460 * (progressValue / 100f)));
                Rectangle fillRect = new Rectangle(40, 268, fillWidth, 10);
                using (GraphicsPath fp = GetRoundedRect(fillRect, 5))
                {
                    using (LinearGradientBrush lgb = new LinearGradientBrush(fillRect, AccentEmerald, Color.FromArgb(52, 211, 153), 0f))
                    {
                        g.FillPath(lgb, fp);
                    }
                }
            }
            else if (currentStage == 2)
            {
                // Success Badge Card
                Rectangle successCard = new Rectangle(40, 160, 460, 140);
                using (GraphicsPath scp = GetRoundedRect(successCard, 10))
                {
                    using (SolidBrush b = new SolidBrush(CardBg))
                    {
                        g.FillPath(b, scp);
                    }
                    using (Pen p = new Pen(Color.FromArgb(30, 60, 50), 1f))
                    {
                        g.DrawPath(p, scp);
                    }
                }

                // Green Checkmark Icon Circle
                Rectangle chkCircle = new Rectangle(64, 195, 42, 42);
                using (SolidBrush b = new SolidBrush(Color.FromArgb(20, 45, 36)))
                {
                    g.FillEllipse(b, chkCircle);
                }
                using (Pen p = new Pen(AccentEmerald, 2f))
                {
                    g.DrawEllipse(p, chkCircle);
                }

                using (Pen chkPen = new Pen(AccentEmerald, 2.5f))
                {
                    chkPen.StartCap = LineCap.Round;
                    chkPen.EndCap = LineCap.Round;
                    g.DrawLine(chkPen, 74, 216, 81, 224);
                    g.DrawLine(chkPen, 81, 224, 95, 206);
                }

                using (Font stFont = new Font("Segoe UI", 13, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(TextPrimary))
                {
                    g.DrawString("Installation Succeeded", stFont, b, 122, 192);
                }

                using (Font sdFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextSecondary))
                {
                    g.DrawString("Haven is ready to run with per-user sandboxing and protocol bindings.", sdFont, b, 122, 217);
                }
            }
        }

        private static GraphicsPath GetRoundedRect(Rectangle bounds, int radius)
        {
            int diameter = radius * 2;
            GraphicsPath path = new GraphicsPath();
            if (radius == 0)
            {
                path.AddRectangle(bounds);
                return path;
            }
            Rectangle arc = new Rectangle(bounds.Location, new Size(diameter, diameter));
            path.AddArc(arc, 180, 90);
            arc.X = bounds.Right - diameter;
            path.AddArc(arc, 270, 90);
            arc.Y = bounds.Bottom - diameter;
            path.AddArc(arc, 0, 90);
            arc.X = bounds.Left;
            path.AddArc(arc, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Silent Mode Support for Automation
            if (args.Length > 0 && (args[0].Equals("--silent", StringComparison.OrdinalIgnoreCase) || args[0].Equals("/S", StringComparison.OrdinalIgnoreCase)))
            {
                return PerformSilentInstall();
            }

            using (InstallerForm form = new InstallerForm())
            {
                Application.Run(form);
            }
            return 0;
        }

        static int PerformSilentInstall()
        {
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(localAppData, "Programs", "Haven");
                if (!Directory.Exists(installDir)) Directory.CreateDirectory(installDir);

                // 1. Locate Payload: Embedded Resource > Adjacent ZIP
                Stream zipStream = null;
                Assembly asm = Assembly.GetExecutingAssembly();
                string[] resNames = asm.GetManifestResourceNames();
                foreach (string name in resNames)
                {
                    if (name.IndexOf("HavenPayload", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        name.IndexOf("payload", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        zipStream = asm.GetManifestResourceStream(name);
                        break;
                    }
                }

                if (zipStream != null)
                {
                    using (ZipArchive archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
                    {
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            string destPath = Path.Combine(installDir, entry.FullName);
                            string destDir = Path.GetDirectoryName(destPath);
                            if (!string.IsNullOrEmpty(destDir) && !Directory.Exists(destDir)) Directory.CreateDirectory(destDir);
                            if (!string.IsNullOrEmpty(entry.Name)) entry.ExtractToFile(destPath, true);
                        }
                    }
                }
                else
                {
                    string currentDir = AppDomain.CurrentDomain.BaseDirectory;
                    string payloadZip = Path.Combine(currentDir, "Haven-1.0.0-win-x64-portable.zip");
                    if (!File.Exists(payloadZip)) payloadZip = Path.Combine(currentDir, "payload.zip");
                    if (!File.Exists(payloadZip)) payloadZip = Path.Combine(currentDir, "..", "..", "desktop", "dist", "Haven-1.0.0-win-x64-portable.zip");
                    if (!File.Exists(payloadZip)) payloadZip = Path.Combine(currentDir, "..", "desktop", "dist", "Haven-1.0.0-win-x64-portable.zip");

                    if (File.Exists(payloadZip))
                    {
                        using (ZipArchive archive = ZipFile.OpenRead(payloadZip))
                        {
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                string destPath = Path.Combine(installDir, entry.FullName);
                                string destDir = Path.GetDirectoryName(destPath);
                                if (!string.IsNullOrEmpty(destDir) && !Directory.Exists(destDir)) Directory.CreateDirectory(destDir);
                                if (!string.IsNullOrEmpty(entry.Name)) entry.ExtractToFile(destPath, true);
                            }
                        }
                    }
                    else
                    {
                        string sourceDir = Path.Combine(currentDir, "Haven-win32-x64");
                        if (!Directory.Exists(sourceDir)) sourceDir = Path.Combine(currentDir, "..", "..", "desktop", "dist", "Haven-win32-x64");
                        if (!Directory.Exists(sourceDir)) sourceDir = Path.Combine(currentDir, "..", "desktop", "dist", "Haven-win32-x64");
                        if (Directory.Exists(sourceDir))
                        {
                            foreach (string dir in Directory.GetDirectories(sourceDir, "*", SearchOption.AllDirectories))
                            {
                                string rel = dir.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar);
                                Directory.CreateDirectory(Path.Combine(installDir, rel));
                            }
                            foreach (string file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
                            {
                                string rel = file.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar);
                                File.Copy(file, Path.Combine(installDir, rel), true);
                            }
                        }
                    }
                }

                string mainExe = Path.Combine(installDir, "Haven.exe");
                string uninstallExe = Path.Combine(installDir, "Haven-Uninstall.exe");

                // Shortcuts
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string startMenuShortcut = Path.Combine(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Haven.lnk");
                InstallerForm.CreateShortcut(startMenuShortcut, mainExe, installDir, "Haven - Secure BitTorrent Client");

                string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Haven.lnk");
                InstallerForm.CreateShortcut(desktopShortcut, mainExe, installDir, "Haven - Secure BitTorrent Client");

                // Protocols & Uninstaller
                InstallerForm.RegisterProtocols(mainExe);
                InstallerForm.RegisterUninstaller(mainExe, uninstallExe, installDir);

                return 0;
            }
            catch
            {
                return 1;
            }
        }
    }
}
