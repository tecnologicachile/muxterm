#!/bin/bash
content=$(base64 -w0)
printf "\033]52;c;%s\007" "$content"
