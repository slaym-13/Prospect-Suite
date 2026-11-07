"""Shared helpers for the three pipeline steps: paths, palette, chart styling."""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parent
RAW_CSV = ROOT.parent / "app" / "data" / "companies.csv"
OUT = ROOT / "outputs"
FIG = OUT / "figures"
CLEAN_CSV = OUT / "companies_clean.csv"

# The Prospect Hub palette, so the report, the charts and the app look like one product.
INK = "#0b0b0b"
MUTED = "#52514e"
ACCENT = "#2a78d6"
ACCENT_SOFT = "#e3effc"
NEUTRAL = "#c3c2b7"
GOOD = "#0ca30c"
WARN = "#e0a106"
BAD = "#d03b3b"
GRID = "#e1e0d9"
RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"]

_AVAILABLE = {f.name for f in font_manager.fontManager.ttflist}
FONT = "Roboto" if "Roboto" in _AVAILABLE else ("Segoe UI" if "Segoe UI" in _AVAILABLE else "DejaVu Sans")


def setup():
    """One matplotlib style for every figure in the report."""
    OUT.mkdir(exist_ok=True)
    FIG.mkdir(exist_ok=True)
    plt.rcParams.update({
        "font.family": FONT,
        "font.size": 12,
        "text.color": INK,
        "axes.labelcolor": MUTED,
        "axes.edgecolor": GRID,
        "axes.titlesize": 15,
        "axes.titleweight": "600",
        "axes.titlecolor": INK,
        "axes.titlepad": 14,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelsize": 11,
        "ytick.labelsize": 11,
        "grid.color": GRID,
        "grid.linewidth": 1,
        "figure.facecolor": "none",
        "axes.facecolor": "none",
        "savefig.facecolor": "none",
        "savefig.transparent": True,
        "savefig.bbox": "tight",
        "savefig.dpi": 200,
    })


def save(fig, name):
    """Write a figure into outputs/figures and close it."""
    path = FIG / f"{name}.png"
    fig.savefig(path)
    plt.close(fig)
    print(f"  figure -> {path.relative_to(ROOT)}")
    return path


def bar_labels(ax, bars, fmt="{:.0f}", pad=3, horizontal=False):
    """Print the value on the end of each bar: a chart you can read without gridlines."""
    for bar in bars:
        if horizontal:
            value = bar.get_width()
            ax.text(value + pad, bar.get_y() + bar.get_height() / 2, fmt.format(value),
                    va="center", ha="left", fontsize=11, color=MUTED)
        else:
            value = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, value + pad, fmt.format(value),
                    ha="center", va="bottom", fontsize=11, color=MUTED)
