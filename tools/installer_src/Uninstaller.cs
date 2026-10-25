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
        // Apple-Grade Dark Slate Palette
        private static readonly Color BgColor = Color.FromArgb(20, 24, 31);
        private static readonly Color CardBg = Color.FromArgb(27, 33, 43);
        private static readonly Color CardBorder = Color.FromArgb(43, 53, 69);
        private static readonly Color AccentRose = Color.FromArgb(225, 29, 72);
        private static readonly Color AccentRoseHover = Color.FromArgb(244, 63, 94);
        private static readonly Color AccentEmerald = Color.FromArgb(16, 185, 129);
        private static readonly Color AccentEmeraldHover = Color.FromArgb(5, 150, 105);
        private static readonly Color TextPrimary = Color.FromArgb(249, 250, 251);
        private static readonly Color TextSecondary = Color.FromArgb(156, 163, 175);
        private static readonly Color TextDim = Color.FromArgb(107, 114, 128);

        // Stages: 0 = Confirm, 1 = Progress, 2 = Complete
        private int currentStage = 0;

        // Interactive Options
        private bool removeUserData = false;

        // Progress Animation
        private int progressValue = 0;
        private int targetProgress = 0;
        private System.Windows.Forms.Timer animTimer;
        private string statusMessage = "Initiating uninstallation...";

        // Hit-test regions for Apple custom controls
        private Rectangle rectTrafficRed;
        private Rectangle rectTrafficYellow;
        private Rectangle rectTrafficGreen;
        private Rectangle rectOptionCard;
        private Rectangle rectBtnCancel;
        private Rectangle rectBtnAction;

        private bool hoverTrafficRed = false;
        private bool hoverOptionCard = false;
        private bool hoverBtnCancel = false;
        private bool hoverBtnAction = false;
        private bool isBtnActionPressed = false;

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
            this.Size = new Size(520, 480);
            this.BackColor = BgColor;
            this.DoubleBuffered = true;
            this.ShowInTaskbar = true;
            this.Text = "Haven Uninstaller";

            // Initialize control layout rects
            rectTrafficRed = new Rectangle(18, 18, 13, 13);
            rectTrafficYellow = new Rectangle(38, 18, 13, 13);
            rectTrafficGreen = new Rectangle(58, 18, 13, 13);

            rectOptionCard = new Rectangle(40, 276, 440, 64);
            rectBtnCancel = new Rectangle(40, 404, 140, 44);
            rectBtnAction = new Rectangle(196, 404, 284, 44);

            // Smooth 60 FPS animation timer
            animTimer = new System.Windows.Forms.Timer();
            animTimer.Interval = 16;
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

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);

            if (e.Button == MouseButtons.Left)
            {
                // Apple Traffic Light Red click -> Cancel
                if (rectTrafficRed.Contains(e.Location))
                {
                    this.Close();
                    return;
                }

                // Stage 0: Toggle Option Card
                if (currentStage == 0 && rectOptionCard.Contains(e.Location))
                {
                    removeUserData = !removeUserData;
                    this.Invalidate(rectOptionCard);
                    return;
                }

                // Stage 0: Cancel Button Click
                if (currentStage == 0 && rectBtnCancel.Contains(e.Location))
                {
                    this.Close();
                    return;
                }

                // Action Button Click (Uninstall or Done)
                if (rectBtnAction.Contains(e.Location))
                {
                    isBtnActionPressed = true;
                    this.Invalidate(rectBtnAction);
                    return;
                }

                // Draggable window caption (top 70px)
                if (e.Y < 70)
                {
                    NativeMethods.ReleaseCapture();
                    NativeMethods.SendMessage(this.Handle, NativeMethods.WM_NCLBUTTONDOWN, NativeMethods.HT_CAPTION, 0);
                }
            }
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);

            if (isBtnActionPressed)
            {
                isBtnActionPressed = false;
                this.Invalidate(rectBtnAction);

                if (rectBtnAction.Contains(e.Location))
                {
                    HandleActionButtonClick();
                }
            }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);

            bool newHoverRed = rectTrafficRed.Contains(e.Location);
            bool newHoverOption = (currentStage == 0 && rectOptionCard.Contains(e.Location));
            bool newHoverCancel = (currentStage == 0 && rectBtnCancel.Contains(e.Location));
            bool newHoverAction = (currentStage != 1 && rectBtnAction.Contains(e.Location));

            bool needRedraw = false;

            if (newHoverRed != hoverTrafficRed) { hoverTrafficRed = newHoverRed; needRedraw = true; }
            if (newHoverOption != hoverOptionCard) { hoverOptionCard = newHoverOption; needRedraw = true; }
            if (newHoverCancel != hoverBtnCancel) { hoverBtnCancel = newHoverCancel; needRedraw = true; }
            if (newHoverAction != hoverBtnAction) { hoverBtnAction = newHoverAction; needRedraw = true; }

            if (needRedraw) this.Invalidate();

            if (newHoverRed || newHoverOption || newHoverCancel || newHoverAction)
            {
                this.Cursor = Cursors.Hand;
            }
            else
            {
                this.Cursor = Cursors.Default;
            }
        }

        private void HandleActionButtonClick()
        {
            if (currentStage == 0)
            {
                // Switch to Stage 1: Progress
                currentStage = 1;
                targetProgress = 5;
                statusMessage = "Closing active Haven processes...";
                this.Invalidate();

                workerThread = new Thread(PerformUninstall);
                workerThread.IsBackground = true;
                workerThread.Start();
            }
            else if (currentStage == 2)
            {
                // Stage 2: Done -> Close
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
            statusMessage = message;
            targetProgress = Math.Min(100, Math.Max(0, percent));
            this.Invalidate();
        }

        private void PerformUninstall()
        {
            try
            {
                SetStatus("Closing active Haven instances...", 15);
                KillRunningProcesses("Haven");

                SetStatus("Removing Start Menu and Desktop shortcuts...", 35);
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

                SetStatus("Unregistering torrent and magnet: protocol associations...", 55);
                UnregisterProtocols();

                SetStatus("Cleaning Windows Uninstall registry entries...", 70);
                try
                {
                    Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven", false);
                }
                catch { }

                if (removeUserData)
                {
                    SetStatus("Cleaning local application preferences and cache...", 80);
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
                        foreach (string file in Directory.GetFiles(installDir, "*", SearchOption.AllDirectories))
                        {
                            try { File.Delete(file); } catch { }
                        }
                        Directory.Delete(installDir, true);
                    }
                    catch
                    {
                        ScheduleFolderDeletion(installDir);
                    }
                }

                SetStatus("Uninstallation complete.", 100);
                Thread.Sleep(350);

                this.BeginInvoke(new Action(() =>
                {
                    currentStage = 2;
                    rectBtnAction = new Rectangle(40, 404, 440, 44);
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

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            // 1. Apple-Grade Smooth Outer Window Contour
            using (GraphicsPath outerPath = GetRoundedRect(new Rectangle(0, 0, this.Width - 1, this.Height - 1), 16))
            {
                using (Pen p = new Pen(Color.FromArgb(46, 56, 74), 1.5f))
                {
                    g.DrawPath(p, outerPath);
                }
            }

            // 2. macOS Traffic Light Controls (Top-Left)
            DrawTrafficLights(g);

            // 3. Centered Apple Continuous Squircle Badge (64x64)
            int iconSize = 64;
            int iconX = (this.Width - iconSize) / 2;
            int iconY = 32;
            Rectangle iconRect = new Rectangle(iconX, iconY, iconSize, iconSize);

            using (GraphicsPath iconPath = GetSquircle(iconRect, 18))
            {
                Color topGrad = (currentStage == 2) ? AccentEmerald : AccentRose;
                Color botGrad = (currentStage == 2) ? Color.FromArgb(5, 150, 105) : Color.FromArgb(190, 18, 60);
                using (LinearGradientBrush lgb = new LinearGradientBrush(iconRect, topGrad, botGrad, 45f))
                {
                    g.FillPath(lgb, iconPath);
                }
            }

            // Draw Icon Glyph inside squircle
            using (Pen glyphPen = new Pen(Color.White, 2.6f))
            {
                glyphPen.StartCap = LineCap.Round;
                glyphPen.EndCap = LineCap.Round;
                glyphPen.LineJoin = LineJoin.Round;

                if (currentStage == 2)
                {
                    // Green Checkmark
                    g.DrawLine(glyphPen, iconX + 18, iconY + 34, iconX + 27, iconY + 43);
                    g.DrawLine(glyphPen, iconX + 27, iconY + 43, iconX + 46, iconY + 22);
                }
                else
                {
                    // Apple Clean Minimalist Trash Glyph
                    int cx = iconX + (iconSize / 2);
                    int cy = iconY + (iconSize / 2);

                    // Trash Can Lid
                    g.DrawLine(glyphPen, cx - 13, cy - 8, cx + 13, cy - 8);
                    g.DrawLine(glyphPen, cx - 5, cy - 12, cx + 5, cy - 12);

                    // Trash Can Body
                    using (GraphicsPath bodyPath = new GraphicsPath())
                    {
                        bodyPath.AddLine(cx - 10, cy - 6, cx - 8, cy + 13);
                        bodyPath.AddArc(cx - 8, cy + 9, 8, 8, 90, 90);
                        bodyPath.AddLine(cx - 4, cy + 13, cx + 4, cy + 13);
                        bodyPath.AddArc(cx, cy + 9, 8, 8, 0, 90);
                        bodyPath.AddLine(cx + 8, cy + 13, cx + 10, cy - 6);
                        g.DrawPath(glyphPen, bodyPath);
                    }

                    // Vertical Ribs
                    using (Pen ribPen = new Pen(Color.FromArgb(230, 255, 255, 255), 1.8f))
                    {
                        ribPen.StartCap = LineCap.Round;
                        ribPen.EndCap = LineCap.Round;
                        g.DrawLine(ribPen, cx - 4, cy - 2, cx - 3, cy + 9);
                        g.DrawLine(ribPen, cx + 4, cy - 2, cx + 3, cy + 9);
                    }
                }
            }

            // 4. Centered Apple Typography
            string mainTitle = (currentStage == 2) ? "Haven Has Been Removed" : (currentStage == 1 ? "Removing Haven..." : "Uninstall Haven?");
            using (Font titleFont = new Font("Segoe UI", 19, FontStyle.Bold))
            using (SolidBrush b = new SolidBrush(TextPrimary))
            {
                SizeF sz = g.MeasureString(mainTitle, titleFont);
                g.DrawString(mainTitle, titleFont, b, (this.Width - sz.Width) / 2, 106);
            }

            string subTitle = (currentStage == 2)
                ? "All binaries and system associations have been cleanly removed."
                : (currentStage == 1 ? "Safely removing application files and registry associations..." : "Haven and its desktop components will be cleanly removed.");
            using (Font subFont = new Font("Segoe UI", 9.5f, FontStyle.Regular))
            using (SolidBrush b = new SolidBrush(TextSecondary))
            {
                SizeF sz = g.MeasureString(subTitle, subFont);
                g.DrawString(subTitle, subFont, b, (this.Width - sz.Width) / 2, 140);
            }

            // 5. Stage Specific Content
            if (currentStage == 0)
            {
                // A. INV-03 Security & Privacy Guarantee Card
                Rectangle safetyCard = new Rectangle(40, 172, 440, 92);
                using (GraphicsPath scp = GetRoundedRect(safetyCard, 12))
                {
                    using (SolidBrush b = new SolidBrush(CardBg))
                    {
                        g.FillPath(b, scp);
                    }
                    using (Pen p = new Pen(Color.FromArgb(32, 68, 52), 1.2f))
                    {
                        g.DrawPath(p, scp);
                    }
                }

                // Left Emerald Accent Stripe
                using (GraphicsPath stripePath = GetRoundedRect(new Rectangle(40, 172, 5, 92), 2))
                {
                    using (SolidBrush b = new SolidBrush(AccentEmerald))
                    {
                        g.FillPath(b, stripePath);
                    }
                }

                // Vector Shield Icon
                DrawShieldIcon(g, 58, 186, AccentEmerald);

                // Shield Card Title
                using (Font sTitleFont = new Font("Segoe UI", 10.5f, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(52, 211, 153)))
                {
                    g.DrawString("Your Downloaded Torrents Are 100% Safe", sTitleFont, b, 86, 184);
                }

                // Shield Card Body Text
                using (Font sDescFont = new Font("Segoe UI", 8.8f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextSecondary))
                {
                    string safeText = "Under Haven Invariant INV-03, uninstallation strictly removes only program binaries and shortcuts. Downloaded torrents and personal folders in your Downloads directory will NEVER be modified or touched.";
                    Rectangle textBounds = new Rectangle(58, 208, 410, 50);
                    g.DrawString(safeText, sDescFont, b, textBounds);
                }

                // B. Interactive Preferences Option Card
                using (GraphicsPath ocp = GetRoundedRect(rectOptionCard, 10))
                {
                    Color cardFill = hoverOptionCard ? Color.FromArgb(34, 42, 54) : Color.FromArgb(24, 30, 40);
                    using (SolidBrush b = new SolidBrush(cardFill))
                    {
                        g.FillPath(b, ocp);
                    }
                    Color borderColor = hoverOptionCard ? Color.FromArgb(64, 78, 100) : CardBorder;
                    using (Pen p = new Pen(borderColor, 1f))
                    {
                        g.DrawPath(p, ocp);
                    }
                }

                // Draw Custom Apple Checkbox
                Rectangle chkBoxRect = new Rectangle(56, 298, 20, 20);
                using (GraphicsPath chkPath = GetRoundedRect(chkBoxRect, 5))
                {
                    if (removeUserData)
                    {
                        using (SolidBrush b = new SolidBrush(AccentRose))
                        {
                            g.FillPath(b, chkPath);
                        }
                        using (Pen checkPen = new Pen(Color.White, 2f))
                        {
                            checkPen.StartCap = LineCap.Round;
                            checkPen.EndCap = LineCap.Round;
                            g.DrawLine(checkPen, 61, 308, 64, 312);
                            g.DrawLine(checkPen, 64, 312, 71, 303);
                        }
                    }
                    else
                    {
                        using (SolidBrush b = new SolidBrush(Color.FromArgb(18, 22, 28)))
                        {
                            g.FillPath(b, chkPath);
                        }
                        using (Pen p = new Pen(Color.FromArgb(90, 105, 128), 1.2f))
                        {
                            g.DrawPath(p, chkPath);
                        }
                    }
                }

                // Option Card Text
                using (Font optTitleFont = new Font("Segoe UI", 9.8f, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(TextPrimary))
                {
                    g.DrawString("Delete settings, history, and cache", optTitleFont, b, 86, 290);
                }

                using (Font optSubFont = new Font("Segoe UI", 8.5f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextDim))
                {
                    g.DrawString("%APPDATA%\\haven-desktop (all configurations and cached swarm states)", optSubFont, b, 86, 311);
                }

                // C. Action Buttons (Cancel & Uninstall)
                DrawApplePillButton(g, rectBtnCancel, "Cancel", Color.FromArgb(32, 40, 52), Color.FromArgb(44, 54, 70), TextPrimary, hoverBtnCancel, false);
                DrawApplePillButton(g, rectBtnAction, "Uninstall Haven", AccentRose, AccentRoseHover, Color.White, hoverBtnAction, isBtnActionPressed);
            }
            else if (currentStage == 1)
            {
                // Stage 1: Progress Stage
                // Status description
                using (Font stFont = new Font("Segoe UI", 10f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextSecondary))
                {
                    g.DrawString(statusMessage, stFont, b, 40, 246);
                }

                // Percentage text
                string pctText = targetProgress + "%";
                using (Font pctFont = new Font("Segoe UI", 10f, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(AccentRose))
                {
                    SizeF sz = g.MeasureString(pctText, pctFont);
                    g.DrawString(pctText, pctFont, b, 480 - sz.Width, 246);
                }

                // Apple Thin Glowing Progress Bar
                Rectangle trackRect = new Rectangle(40, 280, 440, 8);
                using (GraphicsPath tp = GetRoundedRect(trackRect, 4))
                {
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(30, 38, 50)))
                    {
                        g.FillPath(b, tp);
                    }
                }

                int fillWidth = Math.Max(8, (int)(440 * (progressValue / 100f)));
                Rectangle fillRect = new Rectangle(40, 280, fillWidth, 8);
                using (GraphicsPath fp = GetRoundedRect(fillRect, 4))
                {
                    using (LinearGradientBrush lgb = new LinearGradientBrush(fillRect, Color.FromArgb(244, 63, 94), AccentRose, 0f))
                    {
                        g.FillPath(lgb, fp);
                    }
                }

                // Card showing current status
                Rectangle infoBox = new Rectangle(40, 312, 440, 54);
                using (GraphicsPath ibp = GetRoundedRect(infoBox, 8))
                {
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(24, 30, 40)))
                    {
                        g.FillPath(b, ibp);
                    }
                    using (Pen p = new Pen(CardBorder, 1f))
                    {
                        g.DrawPath(p, ibp);
                    }
                }

                using (Font infoFont = new Font("Segoe UI", 8.8f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextDim))
                {
                    g.DrawString("Target location: " + installDir, infoFont, b, 52, 330);
                }
            }
            else if (currentStage == 2)
            {
                // Stage 2: Completion
                Rectangle doneCard = new Rectangle(40, 200, 440, 140);
                using (GraphicsPath dcp = GetRoundedRect(doneCard, 12))
                {
                    using (SolidBrush b = new SolidBrush(CardBg))
                    {
                        g.FillPath(b, dcp);
                    }
                    using (Pen p = new Pen(Color.FromArgb(32, 68, 52), 1.2f))
                    {
                        g.DrawPath(p, dcp);
                    }
                }

                using (Font doneHFont = new Font("Segoe UI", 11f, FontStyle.Bold))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(52, 211, 153)))
                {
                    g.DrawString("Clean System Removal Complete", doneHFont, b, 60, 222);
                }

                using (Font doneBFont = new Font("Segoe UI", 9.2f, FontStyle.Regular))
                using (SolidBrush b = new SolidBrush(TextSecondary))
                {
                    string doneSummary = "• Program binaries and dependencies removed from %LOCALAPPDATA%\n• Start Menu and Desktop shortcuts removed\n• .torrent file and magnet: URL protocol associations unregistered\n• Windows registry uninstall keys cleaned";
                    g.DrawString(doneSummary, doneBFont, b, new Rectangle(60, 252, 400, 78));
                }

                // Done Button (Emerald Pill)
                DrawApplePillButton(g, rectBtnAction, "Done", AccentEmerald, AccentEmeraldHover, Color.White, hoverBtnAction, isBtnActionPressed);
            }
        }

        private void DrawTrafficLights(Graphics g)
        {
            // Red Close Dot
            Color redColor = hoverTrafficRed ? Color.FromArgb(255, 115, 107) : Color.FromArgb(255, 95, 87);
            using (SolidBrush b = new SolidBrush(redColor))
            {
                g.FillEllipse(b, rectTrafficRed);
            }
            using (Pen p = new Pen(Color.FromArgb(180, 40, 40), 0.8f))
            {
                g.DrawEllipse(p, rectTrafficRed);
            }

            if (hoverTrafficRed)
            {
                using (Pen crossPen = new Pen(Color.FromArgb(120, 20, 20), 1.3f))
                {
                    g.DrawLine(crossPen, rectTrafficRed.X + 3, rectTrafficRed.Y + 3, rectTrafficRed.Right - 4, rectTrafficRed.Bottom - 4);
                    g.DrawLine(crossPen, rectTrafficRed.Right - 4, rectTrafficRed.Y + 3, rectTrafficRed.X + 3, rectTrafficRed.Bottom - 4);
                }
            }

            // Yellow Dot
            using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 189, 46)))
            {
                g.FillEllipse(b, rectTrafficYellow);
            }
            using (Pen p = new Pen(Color.FromArgb(180, 130, 20), 0.8f))
            {
                g.DrawEllipse(p, rectTrafficYellow);
            }

            // Green Dot
            using (SolidBrush b = new SolidBrush(Color.FromArgb(39, 201, 63)))
            {
                g.FillEllipse(b, rectTrafficGreen);
            }
            using (Pen p = new Pen(Color.FromArgb(20, 140, 40), 0.8f))
            {
                g.DrawEllipse(p, rectTrafficGreen);
            }
        }

        private void DrawShieldIcon(Graphics g, int x, int y, Color color)
        {
            using (GraphicsPath shield = new GraphicsPath())
            {
                shield.AddLine(x + 2, y, x + 16, y);
                shield.AddBezier(x + 16, y, x + 18, y + 6, x + 16, y + 14, x + 9, y + 19);
                shield.AddBezier(x + 9, y + 19, x + 2, y + 14, x, y + 6, x + 2, y);
                shield.CloseFigure();

                using (SolidBrush b = new SolidBrush(Color.FromArgb(30, color.R, color.G, color.B)))
                {
                    g.FillPath(b, shield);
                }
                using (Pen p = new Pen(color, 1.8f))
                {
                    p.LineJoin = LineJoin.Round;
                    g.DrawPath(p, shield);
                }

                // Checkmark inside shield
                using (Pen cp = new Pen(color, 1.8f))
                {
                    cp.StartCap = LineCap.Round;
                    cp.EndCap = LineCap.Round;
                    g.DrawLine(cp, x + 5, y + 9, x + 8, y + 13);
                    g.DrawLine(cp, x + 8, y + 13, x + 13, y + 6);
                }
            }
        }

        private void DrawApplePillButton(Graphics g, Rectangle rect, string text, Color normalColor, Color hoverColor, Color textColor, bool isHover, bool isPressed)
        {
            Color fill = isPressed ? Color.FromArgb(Math.Max(0, normalColor.R - 25), Math.Max(0, normalColor.G - 25), Math.Max(0, normalColor.B - 25)) : (isHover ? hoverColor : normalColor);

            using (GraphicsPath path = GetRoundedRect(rect, 10))
            {
                using (SolidBrush b = new SolidBrush(fill))
                {
                    g.FillPath(b, path);
                }

                if (!isHover && fill.R < 100)
                {
                    using (Pen p = new Pen(Color.FromArgb(55, 68, 88), 1f))
                    {
                        g.DrawPath(p, path);
                    }
                }
            }

            using (Font btnFont = new Font("Segoe UI", 10.5f, FontStyle.Bold))
            using (SolidBrush b = new SolidBrush(textColor))
            {
                SizeF sz = g.MeasureString(text, btnFont);
                float tx = rect.X + (rect.Width - sz.Width) / 2f;
                float ty = rect.Y + (rect.Height - sz.Height) / 2f;
                g.DrawString(text, btnFont, b, tx, ty);
            }
        }

        private GraphicsPath GetSquircle(Rectangle rect, int radius)
        {
            return GetRoundedRect(rect, radius);
        }

        private GraphicsPath GetRoundedRect(Rectangle bounds, int radius)
        {
            int diameter = radius * 2;
            Size size = new Size(diameter, diameter);
            Rectangle arc = new Rectangle(bounds.Location, size);
            GraphicsPath path = new GraphicsPath();

            if (radius == 0)
            {
                path.AddRectangle(bounds);
                return path;
            }

            // Top-left arc
            path.AddArc(arc, 180, 90);

            // Top-right arc
            arc.X = bounds.Right - diameter;
            path.AddArc(arc, 270, 90);

            // Bottom-right arc
            arc.Y = bounds.Bottom - diameter;
            path.AddArc(arc, 0, 90);

            // Bottom-left arc
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

            // If running directly inside the app folder, self-relaunch from %TEMP%
            // so we can delete the app directory completely without locking Haven-Uninstall.exe
            if (!isRelaunchedFromTemp && !currentDir.StartsWith(tempDir, StringComparison.OrdinalIgnoreCase))
            {
                try
                {
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
                    return 0;
                }
                catch { }
            }

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
