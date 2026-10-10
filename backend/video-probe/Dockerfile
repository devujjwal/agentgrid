# Source digest was verified against FFmpeg's signed 9.0.2 release.
FROM python:3.13-alpine@sha256:2d9aefe2fef018a7eb2c13064c89c71929800fd2e5dccdbf52ea5da5bb8d929a AS build
RUN apk add --no-cache gcc make musl-dev xz
ADD https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz /tmp/ffmpeg.tar.xz
RUN echo "8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e  /tmp/ffmpeg.tar.xz" | sha256sum -c - && mkdir /src && tar -xJf /tmp/ffmpeg.tar.xz --strip-components=1 -C /src
WORKDIR /src
# Inspect local MP4 H.264/AAC streams without network protocols, external codec
# libraries, encoders, filters or a general-purpose player.
RUN ./configure --disable-everything --disable-autodetect --disable-network --disable-doc --disable-x86asm --disable-ffmpeg --disable-ffplay --disable-avdevice --disable-avfilter --disable-swscale --disable-swresample --enable-ffprobe --enable-demuxer=mov --enable-parser=h264,aac --enable-decoder=h264,aac --enable-protocol=file,pipe && make -j2 ffprobe

FROM python:3.13-alpine@sha256:2d9aefe2fef018a7eb2c13064c89c71929800fd2e5dccdbf52ea5da5bb8d929a
# The server uses only Python's standard library; packaging tools are unused.
RUN apk add --no-cache zlib=1.3.2-r1 && rm -rf /usr/local/lib/python3.13/site-packages/*
COPY --from=build /src/ffprobe /usr/bin/ffprobe
COPY --from=build /src/COPYING.LGPLv2.1 /usr/share/licenses/ffprobe/COPYING.LGPLv2.1
WORKDIR /app
COPY server.py /app/server.py
USER 65534:65534
EXPOSE 8080
CMD ["python", "/app/server.py"]
