using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using Microsoft.Win32;

namespace HavenInstaller
{
    class Program
    {
        static int Main(string[] args)
        {
            Console.WriteLine("=================================================");
            Console.WriteLine("  Haven - Per-User Installer (No Admin Rights)   ");
            Console.WriteLine("=================================================");
            Console.WriteLine();

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string installDir = Path.Combine(localAppData, "Programs", "Haven");
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string startMenuDir = Path.Combine(appData, "Microsoft", "Windows", "Start Menu", "Programs");
            string shortcutPath = Path.Combine(startMenuDir, "Haven.lnk");

            Console.WriteLine("Target Installation Directory:");
            Console.WriteLine("  " + installDir);
            Console.WriteLine();

            try
            {
                // 1. Create target directory
                if (!Directory.Exists(installDir))
                {
                    Directory.CreateDirectory(installDir);
                }

                // 2. Find payload zip
                string currentDir = AppDomain.CurrentDomain.BaseDirectory;
                string payloadZip = Path.Combine(currentDir, "payload.zip");
                
                // If not in same folder, check adjacent dist folder
                if (!File.Exists(payloadZip))
                {
                    payloadZip = Path.Combine(currentDir, "Haven-1.0.0-win-x64-portable.zip");
                }

                if (File.Exists(payloadZip))
                {
                    Console.WriteLine("Extracting application payload...");
                    using (ZipArchive archive = ZipFile.OpenRead(payloadZip))
                    {
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
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
                        }
                    }
                }
                else
                {
                    // Copy files directly from source directory if invoked from dist
                    string sourceDir = Path.Combine(currentDir, "Haven-win32-x64");
                    if (Directory.Exists(sourceDir))
                    {
                        Console.WriteLine("Copying binaries to installation directory...");
                        CopyDirectory(sourceDir, installDir);
                    }
                    else
                    {
                        Console.WriteLine("[Error] Payload not found: " + payloadZip);
                        return 1;
                    }
                }

                string mainExe = Path.Combine(installDir, "Haven.exe");
                if (!File.Exists(mainExe))
                {
                    // If files were extracted in subfolder Haven-win32-x64
                    string subExe = Path.Combine(installDir, "Haven-win32-x64", "Haven.exe");
                    if (File.Exists(subExe))
                    {
                        mainExe = subExe;
                        installDir = Path.Combine(installDir, "Haven-win32-x64");
                    }
                }

                // 3. Create Start Menu and Desktop Shortcuts
                Console.WriteLine("Creating Start Menu and Desktop shortcuts...");
                CreateShortcut(shortcutPath, mainExe, installDir, "Haven - Secure BitTorrent Client");

                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string desktopShortcut = Path.Combine(desktopDir, "Haven.lnk");
                CreateShortcut(desktopShortcut, mainExe, installDir, "Haven - Secure BitTorrent Client");

                // 4. Register uninstaller in HKCU
                Console.WriteLine("Registering uninstaller in user registry...");
                string uninstallExe = Path.Combine(installDir, "Haven-Uninstall.exe");
                
                // Copy installer as uninstaller if not exists
                string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                if (!File.Exists(uninstallExe) && File.Exists(currentExe))
                {
                    File.Copy(currentExe, uninstallExe, true);
                }

                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "Haven");
                        key.SetValue("DisplayVersion", "1.0.0");
                        key.SetValue("Publisher", "Haven Contributors");
                        key.SetValue("InstallLocation", installDir);
                        key.SetValue("UninstallString", "\"" + uninstallExe + "\" --uninstall");
                        key.SetValue("DisplayIcon", mainExe);
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }

                Console.WriteLine();
                Console.WriteLine("[SUCCESS] Haven installed successfully!");
                Console.WriteLine("You can launch Haven from your Start Menu or at: " + mainExe);
                
                // If not silent, offer launch
                if (args.Length == 0 || args[0] != "--silent")
                {
                    Console.Write("Launch Haven now? (Y/n): ");
                    string resp = Console.ReadLine();
                    if (string.IsNullOrEmpty(resp) || resp.Trim().ToLower().StartsWith("y"))
                    {
                        Process.Start(new ProcessStartInfo(mainExe) { WorkingDirectory = installDir });
                    }
                }

                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Error] Installation failed: " + ex.Message);
                return 1;
            }
        }

        static void CopyDirectory(string sourceDir, string targetDir)
        {
            foreach (string dir in Directory.GetDirectories(sourceDir, "*", SearchOption.AllDirectories))
            {
                string rel = dir.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar);
                Directory.CreateDirectory(Path.Combine(targetDir, rel));
            }
            foreach (string file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
            {
                string rel = file.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar);
                File.Copy(file, Path.Combine(targetDir, rel), true);
            }
        }

        static void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string description)
        {
            string psCmd = string.Format(
                "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{0}'); $s.TargetPath = '{1}'; $s.WorkingDirectory = '{2}'; $s.Description = '{3}'; $s.IconLocation = '{1},0'; $s.Save()",
                shortcutPath.Replace("'", "''"),
                targetPath.Replace("'", "''"),
                workingDir.Replace("'", "''"),
                description.Replace("'", "''")
            );

            ProcessStartInfo psi = new ProcessStartInfo("powershell", "-NoProfile -NonInteractive -Command \"" + psCmd + "\"")
            {
                CreateNoWindow = true,
                UseShellExecute = false
            };
            using (Process p = Process.Start(psi))
            {
                p.WaitForExit();
            }
        }
    }
}
