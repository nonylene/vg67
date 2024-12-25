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
        "n": "市街地等（開放水域）",
    },
    99: {
        "cc": 9,
        "n": "耕作地（水田雑草群落）",
    },
}

CHU_ADDITIONAL = {
    99: "情報なし",
}

SAI_ADDITIONAL = {
    9999: "情報なし",
}

DESCRIPTION_NOIMAGE = [580000]  # 市街地等


def names(data_dir: pathlib.Path):
    names_raw = data_dir / "hanrei/names_raw"
    names = data_dir / "hanrei/names"
    names.mkdir(parents=True, exist_ok=True)

    # sai
    sai_raw = json.load(open(names_raw / "sai.json"))
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
    chu_raw = json.load(open(names_raw / "chu.json"))
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
    dai_raw = json.load(open(names_raw / "dai.json"))
    for k, v in DAI_ADDITIONAL.items():
        dai_raw[str(k)] = v

    json.dump(
        dai_raw,
        open(names / "dai.json", "w"),
        separators=(",", ":"),
        ensure_ascii=False,
    )

    # shokusei
    shokusei_raw = json.load(open(names_raw / "shokusei.json"))
    shokusei = {k: v["n"] for k, v in shokusei_raw.items()}
    for k, v in SHOKUSEI_ADDITIONAL.items():
        shokusei[str(k)] = v

    json.dump(
        shokusei,
        open(names / "shokusei.json", "w"),
        separators=(",", ":"),
        ensure_ascii=False,
    )


def descriptions(data_dir: pathlib.Path):
    descriptions_raw = data_dir / "hanrei/descriptions_raw"
    descriptions = data_dir / "hanrei/descriptions"
    descriptions.mkdir(parents=True, exist_ok=True)

    for description in descriptions_raw.iterdir():
        data = json.load(open(description))
        if int(description.stem) in DESCRIPTION_NOIMAGE:
            data["image"] = None
        json.dump(data, open(descriptions / description.name, "w"), ensure_ascii=False)


def main(data_dir: pathlib.Path):
    names(data_dir)
    descriptions(data_dir)


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
