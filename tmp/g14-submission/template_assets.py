from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from PIL import Image

root=Path('tmp/g14-submission/template-assets')
root.mkdir(exist_ok=True)
with ZipFile('C:/Users/jigne/Downloads/ThreatLens_Project_Presentation_with_Literature-.pptx') as z:
    for name in z.namelist():
        if name.startswith('ppt/media/') and name.endswith('.jpg'):
            raw=z.read(name)
            with Image.open(BytesIO(raw)) as im:
                print(Path(name).name, im.size)
            (root/Path(name).name).write_bytes(raw)
