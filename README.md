# crd-to-cdktf

Turn Kubernetes Custom Resource Definitions (CRDs) into typesafe CDKTF constructs

## Installation

Install `crd-to-cdktf` as an npm dependency in your project:

```sh
npm i -D crd-to-cdktf`
```

Or download `crd-to-cdktf` as a [single executable application](https://nodejs.org/api/single-executable-applications.html)
from the [releases](https://github.com/ZauberNerd/crd-to-cdktf/releases/latest) page.

## Usage

```plain
Usage: crd-to-cdktf [OPTIONS] [FILE]
  When FILE is not provided, read from stdin.
  Options:
    -h, --help    Print this help message
    -o, --output  Output directory
  Examples:
    kubeclt get crds -o yaml | crd-to-cdktf -o crds
    crd-to-cdktf mycrd.yaml -o crds
```
