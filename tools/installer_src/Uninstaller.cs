using System;
using System.IO;
using System.Diagnostics;
using Microsoft.Win32;

namespace HavenUninstaller
{
    class Program
    {
        static int Main(string[] args)
        {
            Console.WriteLine("=================================================");
            Console.WriteLine("  Haven - Per-User Uninstaller                  ");
            Console.WriteLine("=================================================");
            Console.WriteLine();

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string installDir = Path.Combine(localAppData, "Programs", "Haven");
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string startMenuShortcut = Path.Combine(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Haven.lnk");

            Console.WriteLine("Uninstalling Haven from: " + installDir);
            Console.WriteLine("[SAFETY RULE] Downloaded files and user torrent directories are NEVER touched.");
            Console.WriteLine();

            try
            {
                // 1. Remove Start Menu and Desktop shortcuts
                if (File.Exists(startMenuShortcut))
                {
                    Console.WriteLine("Removing Start Menu shortcut...");
                    File.Delete(startMenuShortcut);
                }

                string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Haven.lnk");
                if (File.Exists(desktopShortcut))
                {
                    Console.WriteLine("Removing Desktop shortcut...");
                    File.Delete(desktopShortcut);
                }

                // 2. Remove registry entry
                Console.WriteLine("Removing registry uninstall key...");
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Haven", false);

                // 3. Delete application directory asynchronously after exit using cmd
                string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                string tempCmd = Path.Combine(Path.GetTempPath(), "haven_uninstall_cleanup.bat");
                
                string script = string.Format(
                    "@echo off\r\ntimeout /t 2 /nobreak >nul\r\nrmdir /s /q \"{0}\"\r\ndel \"%~f0\"\r\n",
                    installDir
                );
                File.WriteAllText(tempCmd, script);

                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", "/c \"" + tempCmd + "\"")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process.Start(psi);

                Console.WriteLine();
                Console.WriteLine("[SUCCESS] Haven uninstalled successfully.");
                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Error] Uninstall failed: " + ex.Message);
                return 1;
            }
        }
    }
}
