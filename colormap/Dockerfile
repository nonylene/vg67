FROM debian:12-slim

RUN apt update && apt install -y mdbtools python3-pip git

WORKDIR /work
RUN mkdir /work/lib

RUN git clone https://github.com/north-road/slyr.git /tmp/slyr

RUN mv /tmp/slyr/slyr_community /work/lib/slyr_community
ENV PYTHONPATH /work/lib

COPY colormap.py /work/colormap.py
