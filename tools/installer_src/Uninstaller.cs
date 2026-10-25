using System;
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace HavenUninstaller
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

    public class UninstallerForm : Form
    {
        private static readonly Color BgColor = Color.FromArgb(11, 15, 20);
        private static readonly Color CardBg = Color.FromArgb(18, 26, 34);
        private static readonly Color BorderColor = Color.FromArgb(32, 45, 59);
        private static readonly Color AccentRose = Color.FromArgb(239, 68, 68);
        private static readonly Color AccentRoseHover = Color.FromArgb(220, 38, 38);
        private static readonly Color TextPrimary = Color.FromArgb(243, 244, 246);
        private static readonly Color TextSecondary = Color.FromArgb(156, 163, 175);
        private static readonly Color TextDim = Color.FromArgb(107, 114, 128);

        private int currentStage = 0; // 0: Confirm, 1: Progress, 2: Complete

        private CheckBox chkRemoveUserData;
        private Button btnUninstall;
        private Button btnCancel;
        private Button btnClose;
        private Label lblStatus;
        private Label lblPercentage;

        private int progressValue = 0;
        private int targetProgress = 0;
        private System.Windows.Forms.Timer animTimer;

        private string installDir;
        private Thread workerThread;

        public UninstallerForm(string explicitInstallDir)
        {
            try { NativeMethods.SetProcessDPIAware(); } catch { }

            if (!string.IsNullOrEmpty(explicitInstallDir) && Directory.Exists(explicitInstallDir))
            {
                installDir = explicitInstallDir;
            }
            else
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                installDir = Path.Combine(localAppData, "Programs", "Haven");
            }

            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Size = new Size(520, 390);
            this.BackColor = BgColor;
            this.DoubleBuffered = true;
            this.ShowInTaskbar = true;
            this.Text = "Haven Uninstaller";

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

            // Checkbox for removing settings
            chkRemoveUserData = new CheckBox();
            chkRemoveUserData.Text = "  Also remove app preferences, state, and swarm cache (%APPDATA%\\haven-desktop)";
            chkRemoveUserData.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            chkRemoveUserData.ForeColor = TextSecondary;
            chkRemoveUserData.BackColor = Color.Transparent;
            chkRemoveUserData.Checked = false;
            chkRemoveUserData.Location = new Point(40, 248);
            chkRemoveUserData.Size = new Size(440, 38);
            chkRemoveUserData.Cursor = Cursors.Hand;
            this.Controls.Add(chkRemoveUserData);

            // Action Buttons
            btnCancel = new Button();
            btnCancel.Text = "Cancel";
            btnCancel.Font = new Font("Segoe UI", 10, FontStyle.Regular);
            btnCancel.ForeColor = TextPrimary;
            btnCancel.BackColor = Color.FromArgb(24, 34, 46);
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.FlatAppearance.BorderSize = 0;
            btnCancel.Size = new Size(130, 42);
            btnCancel.Location = new Point(40, 310);
            btnCancel.Cursor = Cursors.Hand;
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);

            btnUninstall = new Button();
            btnUninstall.Text = "Uninstall Haven";
            btnUninstall.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            btnUninstall.ForeColor = Color.White;
            btnUninstall.BackColor = AccentRose;
            btnUninstall.FlatStyle = FlatStyle.Flat;
            btnUninstall.FlatAppearance.BorderSize = 0;
            btnUninstall.Size = new Size(290, 42);
            btnUninstall.Location = new Point(190, 310);
            btnUninstall.Cursor = Cursors.Hand;
            btnUninstall.Click += BtnUninstall_Click;
            btnUninstall.Paint += (s, e) =>
            {
                Graphics g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath path = GetRoundedRect(new Rectangle(0, 0, btnUninstall.Width, btnUninstall.Height), 8))
                {
                    btnUninstall.Region = new Region(path);
                }
            };
            this.Controls.Add(btnUninstall);

            // Progress labels
            lblStatus = new Label();
            lblStatus.Text = "Starting uninstallation...";
            lblStatus.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            lblStatus.ForeColor = TextSecondary;
            lblStatus.Location = new Point(40, 210);
            lblStatus.Size = new Size(360, 22);
            lblStatus.Visible = false;
            this.Controls.Add(lblStatus);

            lblPercentage = new Label();
            lblPercentage.Text = "0%";
            lblPercentage.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblPercentage.ForeColor = AccentRose;
            lblPercentage.Location = new Point(410, 210);
            lblPercentage.Size = new Size(70, 22);
            lblPercentage.TextAlign = ContentAlignment.TopRight;
            lblPercentage.Visible = false;
            this.Controls.Add(lblPercentage);
        }

        private void BtnUninstall_Click(object sender, EventArgs e)
        {
            if (currentStage == 0)
            {
                currentStage = 1;
                chkRemoveUserData.Visible = false;
                btnCancel.Visible = false;
                btnUninstall.Enabled = false;
                btnUninstall.Text = "Removing Haven...";
                btnUninstall.BackColor = Color.FromArgb(30, 20, 25);
                lblStatus.Visible = true;
                lblPercentage.Visible = true;
                this.Invalidate();

                workerThread = new Thread(PerformUninstall);
                workerThread.IsBackground = true;
                workerThread.Start();
            }
            else if (currentStage == 2)
            {
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

        private void PerformUninstall()
        {
            try
            {
                SetStatus("Closing active Haven instances...", 10);
                KillRunningProcesses("Haven");

                SetStatus("Removing Start Menu and Desktop shortcuts...", 30);
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string startMenuShortcut = Path.Combine(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Haven.lnk");
                if (File.Exists(startMenuShortcut))
                {
                    try { File.Delete(startMenuShortcut); } catch { }
                }

                string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Haven.lnk");
                if (File.Exists(desktopShortcut))
                {
                    try { File.Delete(desktopShortcut); } catch { }
                }

                SetStatus("Unregistering protocol and file associations...", 50);
                UnregisterProtocols();

                SetStatus("Cleaning Windows Uninstall registry entry...", 70);
                try
                {
                    Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven", false);
                }
                catch { }

                if (chkRemoveUserData.Checked)
                {
                    SetStatus("Cleaning local application preferences...", 80);
                    string configDir = Path.Combine(appData, "haven-desktop");
                    if (Directory.Exists(configDir))
                    {
                        try { Directory.Delete(configDir, true); } catch { }
                    }
                }

                SetStatus("Removing application binaries...", 90);
                if (Directory.Exists(installDir))
                {
                    try
                    {
                        // Delete all files inside installDir except any temporarily locked
                        foreach (string file in Directory.GetFiles(installDir, "*", SearchOption.AllDirectories))
                        {
                            try { File.Delete(file); } catch { }
                        }
                        Directory.Delete(installDir, true);
                    }
                    catch
                    {
                        // If locked, launch background self-cleanup cmd to sweep after process exits
                        ScheduleFolderDeletion(installDir);
                    }
                }

                SetStatus("Uninstallation complete.", 100);
                Thread.Sleep(300);

                this.BeginInvoke(new Action(() =>
                {
                    currentStage = 2;
                    lblStatus.Visible = false;
                    lblPercentage.Visible = false;
                    btnUninstall.Enabled = true;
                    btnUninstall.Text = "Done";
                    btnUninstall.BackColor = Color.FromArgb(16, 185, 129); // Green done
                    this.Invalidate();
                }));
            }
            catch (Exception ex)
            {
                this.BeginInvoke(new Action(() =>
                {
                    MessageBox.Show(this, "Uninstallation encountered an issue:\n\n" + ex.Message, "Haven Uninstaller", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    this.Close();
                }));
            }
        }

        private void ScheduleFolderDeletion(string dir)
        {
            try
            {
                string tempCmd = Path.Combine(Path.GetTempPath(), "haven_uninstall_sweep.bat");
                string script = string.Format("@echo off\r\ntimeout /t 2 /nobreak >nul\r\nrmdir /s /q \"{0}\"\r\ndel \"%~f0\"\r\n", dir);
                File.WriteAllText(tempCmd, script);
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c \"" + tempCmd + "\"")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process.Start(psi);
            }
            catch { }
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
                        if (!p.WaitForExit(1500)) p.Kill();
                    }
                    catch { }
                }
            }
            catch { }
        }

        private void UnregisterProtocols()
        {
            try
            {
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\magnet", false);
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\Haven.Torrent", false);

                // If .torrent was pointed to Haven.Torrent, clean it
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Classes\.torrent", true))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("");
                        if (val != null && val.ToString().IndexOf("Haven", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\.torrent", false);
                        }
                    }
                }

                NativeMethods.SHChangeNotify(NativeMethods.SHCNE_ASSOCCHANGED, NativeMethods.SHCNF_IDLIST, IntPtr.Zero, IntPtr.Zero);
            }
            catch { }
        }

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

            // 1. Border & Background
            using (GraphicsPath outerPath = GetRoundedRect(new Rectangle(0, 0, this.Width - 1, this.Height - 1), 12))
            {
                using (Pen p = new Pen(BorderColor, 1.5f))
                {
                    g.DrawPath(p, outerPath);
                }
            }

            // 2. Hero Header
            Rectangle iconRect = new Rectangle(40, 34, 44, 44);
            using (GraphicsPath iconPath = GetRoundedRect(iconRect, 10))
            {
                using (LinearGradientBrush lgb = new LinearGradientBrush(iconRect, AccentRose, Color.FromArgb(190, 24, 93), 45f))
                {
                    g.FillPath(lgb, iconPath);
                }
            }

            // Draw Trash / Removal symbol inside icon
            using (Pen symPen = new Pen(Color.White, 2.5f))
            {
                symPen.StartCap = LineCap.Round;
                symPen.EndCap = LineCap.Round;
                g.DrawLine(symPen, 52, 48, 72, 48);
                g.DrawLine(symPen, 56, 44, 68, 44);
                g.DrawLine(symPen, 55, 48, 56, 66);
                g.DrawLine(symPen, 69, 48, 68, 66);
                g.DrawLine(symPen, 56, 66, 68, 66);
                g.DrawLine(symPen, 60, 52, 60, 62);
                g.DrawLine(symPen, 64, 52, 64, 62);
            }

            using (Font titleFont = new Font("Segoe UI", 18, FontStyle.Bold))
            using (SolidBrush b = new SolidBrush(TextPrimary))
            {
                g.DrawString("Uninstall Haven", titleFont, b, 96, 30);
            }

            using (Font subFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
            using (SolidBrush b = new SolidBrush(TextSecondary))
            {
                g.DrawString("Remove Haven client and protocol bindings from your PC", subFont, b, 98, 56);
            }

            // 3. Stage Content
            if (currentStage == 0)
            {
                // Safety Reassurance Card (Apple Human-Centric Guarantee)
                Rectangle safetyCard = new Rectangle(40, 96, 440, 136);
                using (GraphicsPath scp = GetRoundedRect(safetyCard, 8))
                {
                    using (SolidBrush b = new SolidBrush(CardBg))
                    {
                        g.FillPath(b, scp);
                    }
                    using (Pen p = new Pen(Color.FromArgb(20, 60, 45), 1.2f))
                    {
                        g.DrawPath(p, scp);
                    }
                }

                // Shield / Protection Badge
                using (Font sTitleFont = new Font("Segoe UI", 10.5f, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(52, 211, 153)))
                {
                    g.DrawString("🛡️  Your Downloaded Files Are 100% Protected", sTitleFont, b, 54, 110);
                }

                using (Font sDescFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextSecondary))
                {
                    string safeText = "In strict accordance with Haven security rules (INV-03), uninstallation will only remove the application binaries and shortcuts.\n\nAll your downloaded files, finished media, and user directories in your Downloads folder will NEVER be touched or deleted.";
                    Rectangle textBounds = new Rectangle(54, 138, 412, 85);
                    g.DrawString(safeText, sDescFont, b, textBounds);
                }
            }
            else if (currentStage == 1)
            {
                // Progress Bar
                Rectangle trackRect = new Rectangle(40, 240, 440, 10);
                using (GraphicsPath tp = GetRoundedRect(trackRect, 5))
                {
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(24, 34, 46)))
                    {
                        g.FillPath(b, tp);
                    }
                }

                int fillWidth = Math.Max(10, (int)(440 * (progressValue / 100f)));
                Rectangle fillRect = new Rectangle(40, 240, fillWidth, 10);
                using (GraphicsPath fp = GetRoundedRect(fillRect, 5))
                {
                    using (LinearGradientBrush lgb = new LinearGradientBrush(fillRect, AccentRose, Color.FromArgb(251, 113, 133), 0f))
                    {
                        g.FillPath(lgb, fp);
                    }
                }
            }
            else if (currentStage == 2)
            {
                // Success Badge Card
                Rectangle successCard = new Rectangle(40, 120, 440, 150);
                using (GraphicsPath scp = GetRoundedRect(successCard, 10))
                {
                    using (SolidBrush b = new SolidBrush(CardBg))
                    {
                        g.FillPath(b, scp);
                    }
                    using (Pen p = new Pen(Color.FromArgb(28, 40, 54), 1f))
                    {
                        g.DrawPath(p, scp);
                    }
                }

                using (Font stFont = new Font("Segoe UI", 14, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(TextPrimary))
                {
                    g.DrawString("Haven Successfully Removed", stFont, b, 60, 145);
                }

                using (Font sdFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextSecondary))
                {
                    string doneText = "All binaries, Start Menu shortcuts, and registry protocol associations have been cleanly removed. Your downloaded files remain safe in your folders.";
                    Rectangle textBounds = new Rectangle(60, 180, 400, 70);
                    g.DrawString(doneText, sdFont, b, textBounds);
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

            string currentExe = Process.GetCurrentProcess().MainModule.FileName;
            string currentDir = Path.GetDirectoryName(currentExe);
            string tempDir = Path.GetTempPath();

            // Check if we need to self-relaunch from TEMP to avoid file locks on install directory
            bool isRelaunchedFromTemp = false;
            string targetInstallDir = currentDir;

            for (int i = 0; i < args.Length; i++)
            {
                if (args[i].Equals("--from-temp", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                {
                    isRelaunchedFromTemp = true;
                    targetInstallDir = args[i + 1];
                }
            }

            if (!isRelaunchedFromTemp && !currentDir.StartsWith(tempDir, StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    // Copy to temp and relaunch
                    string tempExe = Path.Combine(tempDir, "Haven-Uninstall-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".exe");
                    File.Copy(currentExe, tempExe, true);
                    string passArgs = "--from-temp \"" + currentDir + "\"";
                    if (args.Length > 0 && (args[0].Equals("--silent", StringComparison.OrdinalIgnoreCase) || args[0].Equals("/S", StringComparison.OrdinalIgnoreCase)))
                    {
                        passArgs += " --silent";
                    }

                    ProcessStartInfo psi = new ProcessStartInfo(tempExe, passArgs)
                    {
                        WorkingDirectory = tempDir
                    };
                    Process.Start(psi);
                    return 0; // Exit original process so folder can be removed
                }
                catch { }
            }

            // Silent Mode Support
            if (args.Length > 0 && (args[0].Equals("--silent", StringComparison.OrdinalIgnoreCase) || args[0].Equals("/S", StringComparison.OrdinalIgnoreCase)))
            {
                return PerformSilentUninstall(targetInstallDir);
            }

            using (UninstallerForm form = new UninstallerForm(targetInstallDir))
            {
                Application.Run(form);
            }
            return 0;
        }

        static int PerformSilentUninstall(string installDir)
        {
            try
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string startMenuShortcut = Path.Combine(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Haven.lnk");
                if (File.Exists(startMenuShortcut)) File.Delete(startMenuShortcut);

                string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Haven.lnk");
                if (File.Exists(desktopShortcut)) File.Delete(desktopShortcut);

                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven", false);
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\magnet", false);
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\Haven.Torrent", false);

                NativeMethods.SHChangeNotify(NativeMethods.SHCNE_ASSOCCHANGED, NativeMethods.SHCNF_IDLIST, IntPtr.Zero, IntPtr.Zero);

                if (Directory.Exists(installDir))
                {
                    Directory.Delete(installDir, true);
                }
                return 0;
            }
            catch
            {
                return 1;
            }
        }
    }
}
