from flask import Flask, render_template, jsonify
import pandas as pd
from ttp_extractor import extract_ttps
import json
from pathlib import Path
from flask import Flask, render_template, jsonify, request
# … other imports …

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/extract_ttps')
def extract_route():
    ttps = extract_ttps()
    return jsonify(ttps)

@app.route('/data')
def data_route():
    return app.response_class(
        response=open('output/ttp_extracted.json','r').read(),
        mimetype='application/json'
    )

# 1️⃣ Bar chart: explode "Affected OS", count each OS once
@app.route('/vuln-by-os')
def vuln_by_os():
    df = pd.read_csv("data/vulnerabilities.csv")
    # split on comma, explode, strip whitespace
    df = df.assign(os_list=df["Affected OS"]
                        .str.split(",")
                        .apply(lambda lst: [x.strip() for x in lst if x.strip()]))
    df2 = df.explode("os_list")
    counts = (df2.groupby("os_list")
                  .size()
                  .reset_index(name="count")
                  .rename(columns={"os_list":"os"}))
    return jsonify(counts.to_dict(orient="records"))

# 2️⃣ Pie chart: map each atomic OS to a family, then % share
@app.route('/vuln-os-proportions')
def vuln_os_props():
    df = pd.read_csv("data/vulnerabilities.csv")
    df = df.assign(os_list=df["Affected OS"]
                        .str.split(",")
                        .apply(lambda lst: [x.strip() for x in lst if x.strip()]))
    df2 = df.explode("os_list")

    def predict_family(x):
        xl = x.lower()
        if "windows" in xl: return "Windows"
        if any(l in xl for l in ["linux","ubuntu","centos","debian","red hat"]):
            return "Linux"
        if "mac" in xl: return "macOS"
        if "android" in xl: return "Android"
        if "ios" in xl or "iphone" in xl or "ipad" in xl: return "iOS"
        return "Other"

    df2["family"] = df2["os_list"].map(predict_family)
    fam = (df2.groupby("family")
              .size()
              .reset_index(name="count"))
    total = fam["count"].sum()
    fam["pct"] = (fam["count"] / total * 100).round(1)
    fam = fam.rename(columns={"family":"os"})
    return jsonify(fam[["os","pct"]].to_dict(orient="records"))

@app.route('/tactics-count')
def tactics_count():
    # load the extracted MITRE TTPs
    ttps_json = Path("output/ttp_extracted.json").read_text(encoding="utf-8")
    ttps = json.loads(ttps_json)
    # count tactics
    counts = {}
    for t in ttps:
        for tac in t.get("tactics", []):
            counts[tac] = counts.get(tac, 0) + 1
    # sort descending
    sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    result = [{"tactic": tac, "count": cnt} for tac, cnt in sorted_counts]
    return jsonify(result)



@app.route('/data-sources-count')
def data_sources_count():
    # Load MITRE ATT&CK JSON
    mitre = json.loads(
        Path('data/mitre_attack.json').read_text(encoding='utf-8')
    )

    # Count data-sources across top-level techniques
    counts = {}
    for obj in mitre.get('objects', []):
        if obj.get('type') == 'attack-pattern' and not obj.get('x_mitre_is_subtechnique', False):
            for src in obj.get('x_mitre_data_sources', []):
                counts[src] = counts.get(src, 0) + 1

    # Take top 10
    top10 = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
    result = [{'source': s, 'count': c} for s, c in top10]
    return jsonify(result)



if __name__ == '__main__':
    app.run(debug=True)
