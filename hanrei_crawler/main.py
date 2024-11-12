import argparse
import json
import pathlib
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass

HANREI_LEGEND_TITLE_ENDPOINT = "http://gis.biodic.go.jp/BiodicWebGIS/GetLegendTitle"
HANREI_LEGEND_EXPLANATION_ENDPOINT = (
    "http://gis.biodic.go.jp/BiodicWebGIS/GetLegendExplanation"
)
SLEEP_SEC = 10


@dataclass
class Legend3rd:
    code: str
    name: str

    @classmethod
    def from_json(cls, value: dict):
        return cls(
            code=value["Legend3rdCode"],
            name=value["Legend3rdName"],
        )


@dataclass
class Legend2nd:
    code: str
    name: str
    third: list[Legend3rd] | None

    @classmethod
    def from_json(cls, value: dict):
        third = value.get("Legend3rd")
        return cls(
            code=value["Legend2ndCode"],
            name=value["Legend2ndName"],
            third=(
                [Legend3rd.from_json(v) for v in third] if third is not None else None
            ),
        )


@dataclass
class Legend1st:
    class_code: str
    class_name: str
    code: str
    name: str
    second: list[Legend2nd] | None

    @classmethod
    def from_json(cls, value: dict):
        second = value.get("Legend2nd")
        return cls(
            class_code=value["Class"],
            class_name=value["ClassName"],
            code=value["Legend1stCode"],
            name=value["Legend1stName"],
            second=(
                [Legend2nd.from_json(v) for v in second] if second is not None else None
            ),
        )


@dataclass
class LegendExplanation:
    code: str
    name: str
    explanation: str
    photo_url: str | None

    @classmethod
    def from_json(cls, value: dict):
        photo_name = value["PhotoName"]
        return cls(
            code=value["LegendCode"],
            name=value["LegendName"],
            explanation=value["Explanation"],
            photo_url=photo_name if photo_name != "" else None,
        )


def get_json(url: str):
    req = urllib.request.urlopen(url)
    if not (200 <= req.getcode() < 300):
        raise RuntimeError(f"Unexpected status code: {req.getcode()}, url: {url}")

    return json.load(req)


def crawl_legend_explanation(
    first_code: str, second_code: str | None, third_code: str | None
) -> LegendExplanation:
    query = {"legend1stcode": first_code}
    if second_code is not None:
        query["legend2ndcode"] = second_code
    if third_code is not None:
        query["legend3rdcode"] = third_code

    url = HANREI_LEGEND_EXPLANATION_ENDPOINT + "?" + urllib.parse.urlencode(query)
    value = get_json(url)
    return LegendExplanation.from_json(value["CLDR"]["Result"][0])


def crawl_photo(base_dir: pathlib.Path, url: str) -> str:
    filename = url.split("/")[-1]
    req = urllib.request.urlopen(url)
    if not (200 <= req.getcode() < 300):
        raise RuntimeError(f"Unexpected status code: {req.getcode()}, url: {url}")

    with open(base_dir / filename, "wb") as f:
        f.write(req.read())

    return filename


def crawl_legend_title(first_code: int) -> Legend1st:
    url = (
        HANREI_LEGEND_TITLE_ENDPOINT
        + "?"
        + urllib.parse.urlencode({"legend1stcode": f"{first_code:02}"})
    )
    value = get_json(url)
    return Legend1st.from_json(value["CLDR"]["Result"])


roman_to_number = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
    "VIII": 8,
    "IX": 9,
    "X": 10,
}


def dump_legend_metadata(out_dir: pathlib.Path, legends: list[Legend1st]):
    names_dir = out_dir / "names"
    names_dir.mkdir(parents=True, exist_ok=True)

    dai = {}
    chu = {}
    sai = {}
    shokusei = {}
    for legend1 in legends:
        dai[int(legend1.code)] = {
            "cc": roman_to_number[legend1.class_code],
            "n": legend1.name,
        }
        shokusei[roman_to_number[legend1.class_code]] = {"n": legend1.class_name}
        if legend1.second is not None:
            for legend2 in legend1.second:
                chu[int(legend1.code + legend2.code)] = {
                    "n": legend2.name,
                }
                if legend2.third is not None:
                    for legend3 in legend2.third:
                        sai[int(legend1.code + legend2.code + legend3.code)] = {
                            "n": legend3.name,
                        }

    json.dump(
        shokusei,
        open(names_dir / "shokusei_raw.json", "w"),
        ensure_ascii=False,
    )
    json.dump(
        dai,
        open(names_dir / "dai_raw.json", "w"),
        ensure_ascii=False,
    )
    json.dump(
        chu,
        open(names_dir / "chu_raw.json", "w"),
        ensure_ascii=False,
    )
    json.dump(
        sai,
        open(names_dir / "sai_raw.json", "w"),
        ensure_ascii=False,
    )


def crawl_dump_legend_explanations(out_dir: pathlib.Path, legends: list[Legend1st]):
    explanations_dir = out_dir / "explanation"
    explanations_dir.mkdir(parents=True, exist_ok=True)

    images_dir = out_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    legend_explanation_args = []
    for legend1 in legends:
        legend_explanation_args.append((legend1.code, None, None))
        if legend1.second is not None:
            for legend2 in legend1.second:
                legend_explanation_args.append((legend1.code, legend2.code, None))
                if legend2.third is not None:
                    for legend3 in legend2.third:
                        legend_explanation_args.append(
                            (legend1.code, legend2.code, legend3.code)
                        )

    for first, second, third in legend_explanation_args:
        exp = crawl_legend_explanation(first, second, third)
        time.sleep(SLEEP_SEC)

        if exp.photo_url is not None:
            image_file = crawl_photo(images_dir, exp.photo_url)
            time.sleep(SLEEP_SEC)
        else:
            image_file = None

        code = str(int(exp.code))  # Remove 0 prefix
        value = {
            "text": exp.explanation,
            "image": image_file,
            "info": "出典: 「統一凡例（植生区分・大区分一覧表）」(環境省生物多様性センター) http://gis.biodic.go.jp/webgis/sc-016.html",
        }

        json.dump(
            value,
            open(explanations_dir / f"{code}.json", "w"),
            separators=(",", ":"),
            ensure_ascii=False,
        )


def main(data_dir: pathlib.Path):
    out_dir = data_dir / "hanrei"
    if out_dir.exists() and not out_dir.is_dir():
        raise RuntimeError(f"Output directory: {out_dir.absolute()} is not a directory")
    out_dir.mkdir(parents=True, exist_ok=True)

    legends: list[Legend1st] = []
    for i in range(1, 59):
        legends.append(crawl_legend_title(i))
        time.sleep(SLEEP_SEC)

    dump_legend_metadata(out_dir, legends)
    crawl_dump_legend_explanations(out_dir, legends)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        "hanrei_crawler",
        "Crawl hanrei description documents from Ministry of Environment Japan",
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
