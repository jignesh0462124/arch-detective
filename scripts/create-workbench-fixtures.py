"""Generate inert synthetic ZIPs for the explicitly requested audit benchmark."""
from pathlib import Path
import zipfile

target = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "workbench"
target.mkdir(parents=True, exist_ok=True)
for count in (14, 90, 500):
    path = target / f"audit-{count}-files.zip"
    # ZIP_STORED prevents compression-ratio defenses mistaking repetitive fixtures for bombs.
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
        for index in range(count):
            content = "<?php\n" + ("echo $_GET['name'];\n" if index == 0 else f"echo 'Synthetic module {index}';\n")
            content += "\n".join(f"// Synthetic module {index}, context line {line}; no credentials or personal data." for line in range(60))
            archive.writestr(f"src/module-{index:03}.php", content + "\n")
    print(f"{count} files: {path} ({path.stat().st_size} bytes)")
