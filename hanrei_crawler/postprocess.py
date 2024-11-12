import argparse
import json
import pathlib

SHOKUSEI_ADDITIONAL = {0: "情報なし"}

DAI_ADDITIONAL = {
    0: {
        "cc": 0,
        "n": "情報なし",
    },
    91: {
        "cc": 10,
        "n": "市街地等（58）",  # Water area
    },
    99: {
        "cc": 9,
        "n": "耕作地（57）",  # Paddy field
    },
}

CHU_ADDITIONAL = {
    99: "情報なし",
}

SAI_ADDITIONAL = {
    9999: "情報なし",
}


def main(data_dir: pathlib.Path):
    names = data_dir / "hanrei/names"

    # sai
    sai_raw = json.load(open(names / "sai_raw.json"))
    sai = {k: v["n"] for k, v in sai_raw.items()}
    for k, v in SAI_ADDITIONAL.items():
        sai[str(k)] = v

    json.dump(
        sai,
        open(names / "sai.json", "w"),
        separators=(",", ":"),
        ensure_ascii=False,
    )

    # chu
    chu_raw = json.load(open(names / "chu_raw.json"))
    chu = {k: v["n"] for k, v in chu_raw.items()}
    for k, v in CHU_ADDITIONAL.items():
        chu[str(k)] = v

    json.dump(
        chu,
        open(names / "chu.json", "w"),
        separators=(",", ":"),
        ensure_ascii=False,
    )

    # dai
    dai_raw = json.load(open(names / "dai_raw.json"))
    for k, v in DAI_ADDITIONAL.items():
        dai_raw[str(k)] = v

    json.dump(
        dai_raw,
        open(names / "dai.json", "w"),
        separators=(",", ":"),
        ensure_ascii=False,
    )

    # shokusei
    shokusei_raw = json.load(open(names / "shokusei_raw.json"))
    shokusei = {k: v["n"] for k, v in shokusei_raw.items()}
    for k, v in SHOKUSEI_ADDITIONAL.items():
        shokusei[str(k)] = v

    json.dump(
        shokusei,
        open(names / "shokusei.json", "w"),
        separators=(",", ":"),
        ensure_ascii=False,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        "hanrei_crawler_postprocess",
        "Convert hanrei_crawler results to CSV for tippiecanoe tile2json",
    )
    parser.add_argument(
        "-d",
        "--data-dir",
        help="Base directory for output files",
        type=pathlib.Path,
        default=pathlib.Path(__file__).parent.parent / "data",
    )
    args = parser.parse_args()
    main(args.data_dir)
