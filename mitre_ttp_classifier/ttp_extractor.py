import json
import spacy
from pathlib import Path

nlp = spacy.load("en_core_web_sm")

def extract_ttps():
    data_path   = Path("data/mitre_attack.json")
    output_path = Path("output/ttp_extracted.json")

    mitre = json.loads(data_path.read_text(encoding="utf-8"))
    objs  = mitre.get("objects", [])

    mains = [o for o in objs
             if o.get("type")=="attack-pattern"
             and not o.get("x_mitre_is_subtechnique", False)]
    subs  = [o for o in objs
             if o.get("type")=="attack-pattern"
             and     o.get("x_mitre_is_subtechnique", False)]

    sub_map = {}
    for s in subs:
        ref = next((r for r in s.get("external_references", [])
                    if r["source_name"]=="mitre-attack"), None)
        if not ref: continue
        sid = ref["external_id"]
        parent = sid.split(".")[0]
        sub_map.setdefault(parent, []).append(sid)

    ttps = []
    for m in mains:
        ref = next((r for r in m.get("external_references", [])
                    if r["source_name"]=="mitre-attack"), None)
        tid = ref["external_id"] if ref else ""
        name    = m.get("name","")
        desc    = m.get("description","")
        plats   = m.get("x_mitre_platforms", [])
        version = m.get("x_mitre_version", "")
        created = m.get("created","").split("T")[0]
        modif   = m.get("modified","").split("T")[0]
        tactics = [p["phase_name"] for p in m.get("kill_chain_phases", [])]
        subsids = sub_map.get(tid, [])
        ents = [(ent.text, ent.label_) for ent in nlp(desc).ents]

        ttps.append({
            "id":            tid,
            "name":          name,
            "description":   desc,
            "tactics":       tactics,
            "platforms":     plats,
            "version":       version,
            "created":       created,
            "modified":      modif,
            "subtechniques": subsids,
            "entities":      ents
        })

    output_path.write_text(json.dumps(ttps, indent=2), encoding="utf-8")
    return ttps
