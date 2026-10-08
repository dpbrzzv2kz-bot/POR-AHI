using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

// Simplifica Natural Earth admin-1 (estados/provincias) a un JSON liviano para pintar el mapa de "estados resenados".
public static class RegionsBuilder
{
    static double[] Dp(List<double[]> pts, int a, int b, double tol)
    {
        // Douglas-Peucker iterativo sobre pts[a..b]; devuelve indices a conservar marcados en 'keep'.
        return null;
    }

    static double SegDist(double[] p, double[] a, double[] b)
    {
        double dx = b[0] - a[0], dy = b[1] - a[1];
        double len2 = dx * dx + dy * dy;
        if (len2 == 0) { double ex = p[0] - a[0], ey = p[1] - a[1]; return Math.Sqrt(ex * ex + ey * ey); }
        double t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        double qx = a[0] + t * dx - p[0], qy = a[1] + t * dy - p[1];
        return Math.Sqrt(qx * qx + qy * qy);
    }

    static void Simplify(List<double[]> pts, int lo, int hi, double tol, bool[] keep)
    {
        var stack = new Stack<int[]>();
        stack.Push(new int[] { lo, hi });
        keep[lo] = true; keep[hi] = true;
        while (stack.Count > 0)
        {
            var seg = stack.Pop();
            int a = seg[0], b = seg[1];
            if (b <= a + 1) continue;
            double max = -1; int idx = -1;
            for (int i = a + 1; i < b; i++)
            {
                double d = SegDist(pts[i], pts[a], pts[b]);
                if (d > max) { max = d; idx = i; }
            }
            if (max > tol && idx > 0)
            {
                keep[idx] = true;
                stack.Push(new int[] { a, idx });
                stack.Push(new int[] { idx, b });
            }
        }
    }

    static List<double[]> SimplifyRing(List<double[]> ring, double tol)
    {
        // Quita el punto de cierre repetido, parte el anillo en el punto mas lejano al primero y simplifica cada mitad.
        if (ring.Count > 1 && ring[0][0] == ring[ring.Count - 1][0] && ring[0][1] == ring[ring.Count - 1][1]) ring = ring.GetRange(0, ring.Count - 1);
        int n = ring.Count;
        if (n < 4) return ring;
        int far = 0; double best = -1;
        for (int i = 1; i < n; i++)
        {
            double dx = ring[i][0] - ring[0][0], dy = ring[i][1] - ring[0][1];
            double d = dx * dx + dy * dy;
            if (d > best) { best = d; far = i; }
        }
        var seq = new List<double[]>(ring);
        seq.Add(ring[0]);
        var keep = new bool[seq.Count];
        Simplify(seq, 0, far, tol, keep);
        Simplify(seq, far, seq.Count - 1, tol, keep);
        var outp = new List<double[]>();
        for (int i = 0; i < seq.Count - 1; i++) if (keep[i]) outp.Add(seq[i]);
        return outp;
    }

    static double Area(List<double[]> r)
    {
        double s = 0;
        for (int i = 0; i < r.Count; i++) { var a = r[i]; var b = r[(i + 1) % r.Count]; s += a[0] * b[1] - b[0] * a[1]; }
        return Math.Abs(s) / 2;
    }

    static string Num(double v, int dec)
    {
        double r = Math.Round(v, dec);
        if (r == 0) r = 0;
        return r.ToString(dec == 0 ? "0" : "0." + new string('#', dec), CultureInfo.InvariantCulture);
    }

    static string Esc(string s)
    {
        if (s == null) return "";
        var sb = new StringBuilder();
        foreach (char c in s)
        {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c < 32) sb.Append(' ');
            else sb.Append(c);
        }
        return sb.ToString();
    }

    static string Str(Dictionary<string, object> d, string k)
    {
        object v;
        return d.TryGetValue(k, out v) && v != null ? Convert.ToString(v, CultureInfo.InvariantCulture) : "";
    }

    public static string Build(string input, string output, double tol, int dec, double minSize)
    {
        var ser = new JavaScriptSerializer();
        ser.MaxJsonLength = int.MaxValue;
        ser.RecursionLimit = 100000;
        var root = (Dictionary<string, object>)ser.DeserializeObject(File.ReadAllText(input, Encoding.UTF8));
        var feats = (object[])root["features"];
        var sb = new StringBuilder();
        sb.Append("[");
        bool firstFeat = true;
        int regions = 0, rings = 0, points = 0, skipped = 0;
        foreach (object fo in feats)
        {
            var f = (Dictionary<string, object>)fo;
            var props = (Dictionary<string, object>)f["properties"];
            var geom = f["geometry"] as Dictionary<string, object>;
            if (geom == null) { skipped++; continue; }
            string type = (string)geom["type"];
            var coords = (object[])geom["coordinates"];
            var polys = new List<object[]>();
            if (type == "Polygon") polys.Add(coords);
            else if (type == "MultiPolygon") foreach (object p in coords) polys.Add((object[])p);
            else { skipped++; continue; }

            var outPolys = new List<List<List<double[]>>>();
            double bestArea = -1; int bestIdx = -1;
            double minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
            foreach (var poly in polys)
            {
                var outRings = new List<List<double[]>>();
                for (int ri = 0; ri < poly.Length; ri++)
                {
                    var raw = new List<double[]>();
                    foreach (object po in (object[])poly[ri])
                    {
                        var pa = (object[])po;
                        raw.Add(new double[] { Convert.ToDouble(pa[0], CultureInfo.InvariantCulture), Convert.ToDouble(pa[1], CultureInfo.InvariantCulture) });
                    }
                    var simp = SimplifyRing(raw, tol);
                    // Redondea y quita repetidos consecutivos.
                    var rounded = new List<double[]>();
                    foreach (var q in simp)
                    {
                        double x = Math.Round(q[0], dec), y = Math.Round(q[1], dec);
                        if (rounded.Count == 0 || rounded[rounded.Count - 1][0] != x || rounded[rounded.Count - 1][1] != y) rounded.Add(new double[] { x, y });
                    }
                    if (rounded.Count < 3) { if (ri == 0) break; else continue; }
                    outRings.Add(rounded);
                }
                if (outRings.Count == 0) continue;
                double area = Area(outRings[0]);
                if (area > bestArea) { bestArea = area; bestIdx = outPolys.Count; }
                outPolys.Add(outRings);
            }
            if (outPolys.Count == 0) { skipped++; continue; }

            // Quita islas diminutas, pero conserva siempre el poligono mas grande de la region.
            var finalPolys = new List<List<List<double[]>>>();
            for (int i = 0; i < outPolys.Count; i++)
            {
                var shell = outPolys[i][0];
                double pminx = 1e9, pminy = 1e9, pmaxx = -1e9, pmaxy = -1e9;
                foreach (var q in shell) { if (q[0] < pminx) pminx = q[0]; if (q[0] > pmaxx) pmaxx = q[0]; if (q[1] < pminy) pminy = q[1]; if (q[1] > pmaxy) pmaxy = q[1]; }
                bool tiny = Math.Max(pmaxx - pminx, pmaxy - pminy) < minSize;
                if (i == bestIdx || !tiny)
                {
                    finalPolys.Add(outPolys[i]);
                    if (pminx < minx) minx = pminx; if (pminy < miny) miny = pminy; if (pmaxx > maxx) maxx = pmaxx; if (pmaxy > maxy) maxy = pmaxy;
                }
            }

            string id = Str(props, "adm1_code");
            if (id == "" || id == "-99") id = Str(props, "iso_3166_2");
            if (!firstFeat) sb.Append(",");
            firstFeat = false;
            sb.Append("{\"i\":\"").Append(Esc(id)).Append("\",\"n\":\"").Append(Esc(Str(props, "name"))).Append("\",\"a\":\"").Append(Esc(Str(props, "admin"))).Append("\",\"b\":[")
              .Append(Num(minx, dec)).Append(",").Append(Num(miny, dec)).Append(",").Append(Num(maxx, dec)).Append(",").Append(Num(maxy, dec)).Append("],\"p\":[");
            for (int pi = 0; pi < finalPolys.Count; pi++)
            {
                if (pi > 0) sb.Append(",");
                sb.Append("[");
                for (int ri = 0; ri < finalPolys[pi].Count; ri++)
                {
                    if (ri > 0) sb.Append(",");
                    sb.Append("[");
                    var ring = finalPolys[pi][ri];
                    for (int k = 0; k < ring.Count; k++)
                    {
                        if (k > 0) sb.Append(",");
                        sb.Append(Num(ring[k][0], dec)).Append(",").Append(Num(ring[k][1], dec));
                        points++;
                    }
                    sb.Append("]");
                    rings++;
                }
                sb.Append("]");
            }
            sb.Append("]}");
            regions++;
        }
        sb.Append("]");
        File.WriteAllText(output, sb.ToString(), new UTF8Encoding(false));
        return "regiones=" + regions + " anillos=" + rings + " puntos=" + points + " omitidas=" + skipped;
    }
}
