using System;
using System.IO;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

namespace HavenIconBuilder
{
    class Program
    {
        static void Main(string[] args)
        {
            string root = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".."));
            Console.WriteLine("Haven Icon Builder -> Root: " + root);

            int[] sizes = new int[] { 256, 128, 64, 48, 32, 16 };
            Bitmap[] bitmaps = new Bitmap[sizes.Length];

            for (int i = 0; i < sizes.Length; i++)
            {
                bitmaps[i] = RenderHavenIcon(sizes[i]);
            }

            // Save High-Res PNGs
            string pngDesktop = Path.Combine(root, "desktop", "icon.png");
            string pngWeb = Path.Combine(root, "desktop", "web", "icon.png");
            string pngRootWeb = Path.Combine(root, "web", "icon.png");
            string pngSite = Path.Combine(root, "site", "icon.png");

            bitmaps[0].Save(pngDesktop, ImageFormat.Png);
            bitmaps[0].Save(pngWeb, ImageFormat.Png);
            bitmaps[0].Save(pngRootWeb, ImageFormat.Png);
            bitmaps[0].Save(pngSite, ImageFormat.Png);

            Console.WriteLine("Saved 256x256 PNGs.");

            // Save Multi-Res ICOs
            string icoDesktop = Path.Combine(root, "desktop", "icon.ico");
            string icoDist = Path.Combine(root, "desktop", "dist", "icon.ico");
            string icoSite = Path.Combine(root, "site", "favicon.ico");
            string icoWeb = Path.Combine(root, "desktop", "web", "favicon.ico");

            SaveIco(bitmaps, icoDesktop);
            if (Directory.Exists(Path.Combine(root, "desktop", "dist")))
            {
                SaveIco(bitmaps, icoDist);
            }
            SaveIco(bitmaps, icoSite);
            SaveIco(bitmaps, icoWeb);

            Console.WriteLine("Saved multi-resolution ICOs successfully.");
        }

        static Bitmap RenderHavenIcon(int size)
        {
            Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.Clear(Color.Transparent);

                float s = size / 24.0f;

                // 1. Dark Rounded Squircle Background
                float radius = 4.2f * s;
                using (GraphicsPath bgPath = new GraphicsPath())
                {
                    float d = radius * 2f;
                    bgPath.AddArc(0, 0, d, d, 180, 90);
                    bgPath.AddArc(size - d, 0, d, d, 270, 90);
                    bgPath.AddArc(size - d, size - d, d, d, 0, 90);
                    bgPath.AddArc(0, size - d, d, d, 90, 90);
                    bgPath.CloseFigure();

                    using (LinearGradientBrush bgBrush = new LinearGradientBrush(
                        new PointF(0, 0),
                        new PointF(size, size),
                        Color.FromArgb(255, 15, 23, 42), // #0f172a Slate 900
                        Color.FromArgb(255, 7, 10, 19)))  // #070a13 Deep Navy
                    {
                        g.FillPath(bgBrush, bgPath);
                    }

                    using (Pen borderPen = new Pen(Color.FromArgb(80, 56, 189, 248), Math.Max(1.0f, 0.8f * s)))
                    {
                        g.DrawPath(borderPen, bgPath);
                    }
                }

                // 2. Haven Cyber-Shield Geometry
                // Top Diamond: (12, 2.5) -> (3, 7.2) -> (12, 12) -> (21, 7.2)
                PointF[] diamond = new PointF[]
                {
                    new PointF(12.0f * s, 2.5f * s),
                    new PointF(3.0f * s, 7.2f * s),
                    new PointF(12.0f * s, 12.0f * s),
                    new PointF(21.0f * s, 7.2f * s)
                };

                using (GraphicsPath diamondPath = new GraphicsPath())
                {
                    diamondPath.AddPolygon(diamond);

                    // Translucent electric cyan gradient fill
                    using (LinearGradientBrush fill = new LinearGradientBrush(
                        new PointF(12f * s, 2.5f * s),
                        new PointF(12f * s, 12.0f * s),
                        Color.FromArgb(200, 14, 165, 233), // Sky 500
                        Color.FromArgb(80, 2, 132, 199)))  // Sky 600
                    {
                        g.FillPath(fill, diamondPath);
                    }

                    float strokeWidth = Math.Max(1.4f, 1.8f * s);
                    using (Pen topPen = new Pen(Color.FromArgb(255, 56, 189, 248), strokeWidth)) // Sky 400
                    {
                        topPen.StartCap = LineCap.Round;
                        topPen.EndCap = LineCap.Round;
                        topPen.LineJoin = LineJoin.Round;
                        g.DrawPath(topPen, diamondPath);
                    }
                }

                float stroke = Math.Max(1.4f, 1.8f * s);

                // 3. Middle Chevron: (3, 12.2) -> (12, 16.8) -> (21, 12.2)
                PointF[] midChevron = new PointF[]
                {
                    new PointF(3.0f * s, 12.2f * s),
                    new PointF(12.0f * s, 16.8f * s),
                    new PointF(21.0f * s, 12.2f * s)
                };
                using (Pen midPen = new Pen(Color.FromArgb(255, 14, 165, 233), stroke))
                {
                    midPen.StartCap = LineCap.Round;
                    midPen.EndCap = LineCap.Round;
                    midPen.LineJoin = LineJoin.Round;
                    g.DrawLines(midPen, midChevron);
                }

                // 4. Bottom Chevron: (3, 17.2) -> (12, 21.8) -> (21, 17.2)
                PointF[] bottomChevron = new PointF[]
                {
                    new PointF(3.0f * s, 17.2f * s),
                    new PointF(12.0f * s, 21.8f * s),
                    new PointF(21.0f * s, 17.2f * s)
                };
                using (Pen bottomPen = new Pen(Color.FromArgb(255, 2, 132, 199), stroke))
                {
                    bottomPen.StartCap = LineCap.Round;
                    bottomPen.EndCap = LineCap.Round;
                    bottomPen.LineJoin = LineJoin.Round;
                    g.DrawLines(bottomPen, bottomChevron);
                }
            }
            return bmp;
        }

        static void SaveIco(Bitmap[] bitmaps, string outputPath)
        {
            string dir = Path.GetDirectoryName(outputPath);
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            using (FileStream fs = File.Create(outputPath))
            using (BinaryWriter bw = new BinaryWriter(fs))
            {
                // ICONDIR:
                bw.Write((ushort)0); // Reserved
                bw.Write((ushort)1); // Type: 1 = Icon
                bw.Write((ushort)bitmaps.Length); // Count

                byte[][] pngBytes = new byte[bitmaps.Length][];
                for (int i = 0; i < bitmaps.Length; i++)
                {
                    using (MemoryStream ms = new MemoryStream())
                    {
                        bitmaps[i].Save(ms, ImageFormat.Png);
                        pngBytes[i] = ms.ToArray();
                    }
                }

                int offset = 6 + (16 * bitmaps.Length);

                for (int i = 0; i < bitmaps.Length; i++)
                {
                    Bitmap b = bitmaps[i];
                    byte w = (byte)(b.Width >= 256 ? 0 : b.Width);
                    byte h = (byte)(b.Height >= 256 ? 0 : b.Height);

                    // ICONDIRENTRY:
                    bw.Write(w);
                    bw.Write(h);
                    bw.Write((byte)0); // Color count
                    bw.Write((byte)0); // Reserved
                    bw.Write((ushort)1); // Color planes
                    bw.Write((ushort)32); // Bits per pixel
                    bw.Write((uint)pngBytes[i].Length); // Size of image data
                    bw.Write((uint)offset); // Offset of image data

                    offset += pngBytes[i].Length;
                }

                for (int i = 0; i < bitmaps.Length; i++)
                {
                    bw.Write(pngBytes[i]);
                }
            }
        }
    }
}
