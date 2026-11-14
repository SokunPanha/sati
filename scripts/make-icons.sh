#!/bin/sh
# Regenerates the PNG icons in public/icons from the compass logo SVGs (needs rsvg-convert).
set -e
cd "$(dirname "$0")/../public/icons"
rsvg-convert -w 192 -h 192 icon.svg -o pwa-192.png
rsvg-convert -w 512 -h 512 icon.svg -o pwa-512.png
rsvg-convert -w 512 -h 512 icon-maskable.svg -o maskable-512.png
rsvg-convert -w 180 -h 180 icon-full.svg -o apple-touch-icon-180.png
rsvg-convert -w 32 -h 32 icon.svg -o favicon-32.png
rsvg-convert -w 96 -h 96 badge.svg -o badge-96.png
