#!/bin/bash

JEKYLL="bundle exec jekyll"

# --drafts
$JEKYLL build && \
$JEKYLL serve --host 0.0.0.0 --watch --incremental --drafts
