#!/bin/sh
set -e

IMAGES_DIR="/app/images"
OVERLAYS_DIR="/app/overlays"
DATA_DIR="/app/data"
BASE_IMG="$IMAGES_DIR/base.qcow2"
ALPINE_URL="https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.2-x86_64-bios-tiny-r0.qcow2"

mkdir -p "$IMAGES_DIR" "$OVERLAYS_DIR" "$DATA_DIR"

if [ ! -f "$BASE_IMG" ]; then
    echo "Downloading Cloud image.."
    wget -O "$BASE_IMG" "$ALPINE_URL"
fi

