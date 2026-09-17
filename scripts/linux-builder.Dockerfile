FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH=/root/.cargo/bin:/root/.local/share/pnpm:/usr/local/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates curl file git pkg-config wget \
    libssl-dev libxdo-dev squashfs-tools \
    libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev \
    patchelf rpm dpkg-dev elfutils xdg-utils libfuse2 \
  && (apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.1-dev libsoup-3.0-dev \
    || apt-get install -y --no-install-recommends \
      libwebkit2gtk-4.0-dev libsoup2.4-dev) \
  && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get update && apt-get install -y --no-install-recommends nodejs \
  && corepack enable \
  && corepack prepare pnpm@10.12.3 --activate \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
