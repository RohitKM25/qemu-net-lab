#!/bin/sh
set -e

IMAGES_DIR="/app/images"
OVERLAYS_DIR="/app/overlays"
DATA_DIR="/app/data"
BASE_IMG="$IMAGES_DIR/base.qcow2"
ROUTER_IMG="$IMAGES_DIR/router.qcow2"
ALPINE_URL="https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.2-x86_64-bios-tiny-r0.qcow2"
ROUTER_URL="https://labs.networkgeek.in/router.qcow2"

mkdir -p "$IMAGES_DIR" "$OVERLAYS_DIR" "$DATA_DIR"

if [ ! -f "$BASE_IMG" ]; then
    echo "Downloading BASE Cloud image.."
    wget -O "$BASE_IMG" "$ALPINE_URL"
fi

if [ ! -f "$ROUTER_IMG" ]; then
    echo "Downloading ROUTER Cloud image.."
    wget -O "$ROUTER_IMG" "$ROUTER_URL"
fi

