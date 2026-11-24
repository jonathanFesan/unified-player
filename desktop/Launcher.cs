// Launcher do Unified Player para Windows.
// Sobe o servidor Next.js (node.exe + server.js empacotados ao lado) em 127.0.0.1:3000
// e abre o app numa janela própria do Microsoft Edge (modo --app, com Widevine para o Spotify).
// Ao fechar a janela, o servidor é encerrado.
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

static class Launcher
{
    const string Url = "http://127.0.0.1:3000";

    [STAThread]
    static int Main()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string appDir = Path.Combine(baseDir, "app");
        string node = Path.Combine(appDir, "node.exe");
        string server = Path.Combine(appDir, "server.js");

        if (!File.Exists(node) || !File.Exists(server))
        {
            Fail("Arquivos do app não encontrados em:\n" + appDir);
            return 1;
        }

        Process serverProc = null;
        if (!IsUp())
        {
            var psi = new ProcessStartInfo(node, "\"" + server + "\"")
            {
                WorkingDirectory = appDir,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            psi.EnvironmentVariables["PORT"] = "3000";
            psi.EnvironmentVariables["HOSTNAME"] = "127.0.0.1";
            psi.EnvironmentVariables["NODE_ENV"] = "production";
            serverProc = Process.Start(psi);

            var deadline = DateTime.Now.AddSeconds(30);
            while (!IsUp())
            {
                if (serverProc.HasExited) { Fail("O servidor encerrou ao iniciar (a porta 3000 está ocupada?)."); return 1; }
                if (DateTime.Now > deadline) { Kill(serverProc); Fail("O servidor não respondeu em 30s."); return 1; }
                Thread.Sleep(250);
            }
        }

        string edge = FindEdge();
        if (edge == null)
        {
            // Sem Edge: abre no navegador padrão e mantém o servidor até o usuário confirmar.
            Process.Start(Url);
            MessageBox.Show("Unified Player rodando em " + Url + "\n\nClique OK para encerrar.", "Unified Player");
            Kill(serverProc);
            return 0;
        }

        string profile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "UnifiedPlayer", "EdgeProfile");
        Directory.CreateDirectory(profile);

        var browser = Process.Start(new ProcessStartInfo(edge,
            "--app=" + Url + " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check " +
            "--autoplay-policy=no-user-gesture-required --window-size=1400,900")
        { UseShellExecute = false });

        browser.WaitForExit();
        // Se o Edge repassou para uma instância já aberta do mesmo perfil, espera ela fechar.
        while (ProfileInUse(profile)) Thread.Sleep(1000);

        Kill(serverProc);
        return 0;
    }

    static bool IsUp()
    {
        try
        {
            var req = (HttpWebRequest)WebRequest.Create(Url);
            req.Timeout = 1000;
            using (var res = (HttpWebResponse)req.GetResponse()) return true;
        }
        catch (WebException e) { return e.Response != null; }
        catch { return false; }
    }

    static bool ProfileInUse(string profile)
    {
        string lockFile = Path.Combine(profile, "lockfile");
        if (!File.Exists(lockFile)) return false;
        try { using (File.Open(lockFile, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) return false; }
        catch (IOException) { return true; }
        catch { return false; }
    }

    static string FindEdge()
    {
        string[] candidates = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
        };
        foreach (var c in candidates) if (File.Exists(c)) return c;
        return null;
    }

    static void Kill(Process p)
    {
        try { if (p != null && !p.HasExited) p.Kill(); } catch { }
    }

    static void Fail(string msg)
    {
        MessageBox.Show(msg, "Unified Player", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
