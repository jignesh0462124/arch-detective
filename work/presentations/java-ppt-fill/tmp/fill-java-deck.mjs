import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const [, , inputPptx, outputPptx, qaDir] = process.argv;
if (!inputPptx || !outputPptx || !qaDir) {
  console.error("Usage: node fill-java-deck.mjs <input.pptx> <output.pptx> <qa-dir>");
  process.exit(2);
}

const PURPLE = "#660087";
const ORANGE = "#E48312";
const RED = "#C00000";
const BLACK = "#000000";
const LIGHT_PURPLE = "rgba(112, 48, 160, 0.12)";
const BULLET = "\u2022";

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function setTextBox(presentation, id, text, style) {
  const box = presentation.resolve(id);
  box.text = text;
  box.text.style = style;
  return box;
}

function addText(slide, name, text, position, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = {
    typeface: "Calibri",
    fontSize: 32,
    color: BLACK,
    lineSpacing: 1.05,
    ...style,
  };
  return box;
}

function addLabel(slide, name, text, left, top, width) {
  return addText(slide, name, text, { left, top, width, height: 48 }, {
    typeface: "Calibri",
    fontSize: 36,
    bold: true,
    color: PURPLE,
  });
}

function addBulletList(slide, name, items, position, style = {}) {
  const box = addText(slide, name, "", position, {
    fontSize: 31,
    lineSpacing: 1.1,
    ...style,
  });
  box.text.set(items.map((item) => ({
    bulletCharacter: BULLET,
    marginLeft: 28,
    indent: -16,
    spaceAfter: 8,
    runs: Array.isArray(item) ? item : [item],
  })));
  box.text.style = {
    typeface: "Calibri",
    fontSize: style.fontSize ?? 31,
    color: style.color ?? BLACK,
    lineSpacing: style.lineSpacing ?? 1.1,
  };
  return box;
}

function addPanel(slide, name, position) {
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position,
    fill: LIGHT_PURPLE,
    line: { style: "solid", fill: "rgba(112, 48, 160, 0.28)", width: 1 },
    borderRadius: "rounded-lg",
  });
}

async function main() {
  await fs.mkdir(path.dirname(outputPptx), { recursive: true });
  await fs.mkdir(qaDir, { recursive: true });

  const presentation = await PresentationFile.importPptx(await FileBlob.load(inputPptx));
  const [s1, s2, s3, s4, s5, s6] = presentation.slides.items;

  presentation.resolve("sh/9072xkry").position = { left: 0, top: 0, width: 1920, height: 1080 };

  setTextBox(presentation, "sh/ul4vaxgb", "Java Programming\nA concise overview of language fundamentals", {
    typeface: "Times New Roman",
    fontSize: 54,
    bold: true,
    color: RED,
    alignment: "center",
    lineSpacing: 1,
  });

  const agenda = presentation.resolve("sh/ozy1ofad");
  agenda.position = { left: 256, top: 260, width: 900, height: 430 };
  agenda.text.set([
    "Introduction to Java",
    "How Java Works: JDK, JRE and JVM",
    "Basic Program Structure",
    "Object-Oriented Programming",
    "Control Flow and Applications",
  ].map((item) => ({
    bulletCharacter: BULLET,
    marginLeft: 34,
    indent: -20,
    spaceAfter: 34,
    runs: [item],
  })));
  agenda.text.style = {
    typeface: "Calibri",
    fontSize: 38,
    bold: true,
    color: BLACK,
    lineSpacing: 1,
    autoFit: "none",
  };
  agenda.position = { left: 256, top: 260, width: 900, height: 430 };

  setTextBox(presentation, "sh/3ah8rqlg", "Introduction", {
    typeface: "Times New Roman",
    fontSize: 77,
    bold: true,
    color: BLACK,
    alignment: "center",
  });
  addLabel(s3, "java-at-a-glance-label", "Java at a Glance", 180, 250, 660);
  addBulletList(s3, "java-at-a-glance-bullets", [
    "High-level, class-based and object-oriented language.",
    "Developed by Sun Microsystems in 1995; now maintained by Oracle.",
    [{ run: "Core principle: ", textStyle: { bold: true } }, "Write Once, Run Anywhere."],
    "Runs across Windows, Linux and macOS through the JVM.",
  ], { left: 180, top: 315, width: 720, height: 390 }, { fontSize: 31 });
  addLabel(s3, "java-uses-label", "Where Java Is Used", 1010, 250, 650);
  addBulletList(s3, "java-uses-bullets", [
    "Desktop, web and backend applications.",
    "Android applications and embedded systems.",
    "Banking, enterprise and cloud-based software.",
    "Games, big-data tools and secure services.",
  ], { left: 1010, top: 315, width: 720, height: 350 }, { fontSize: 31 });
  addText(s3, "java-features-strip", "Key features: simple | platform independent | secure | robust | portable | multithreaded | automatic memory management", {
    left: 180,
    top: 805,
    width: 1560,
    height: 76,
  }, { fontSize: 30, bold: true, color: PURPLE, alignment: "center" });

  setTextBox(presentation, "sh/1cj2d8b6", "How Java Works", {
    typeface: "Times New Roman",
    fontSize: 67,
    bold: true,
    color: BLACK,
    alignment: "center",
  });
  addText(s4, "execution-flow-subtitle", "Source Code -> Compiler -> Bytecode -> JVM -> Machine Output", {
    left: 360,
    top: 132,
    width: 1200,
    height: 42,
  }, { fontSize: 30, bold: true, color: PURPLE, alignment: "center" });
  const flowTable = presentation.resolve("tb/tsnut0v2");
  flowTable.columns.get(0).width = 170;
  flowTable.columns.get(1).width = 270;
  flowTable.columns.get(2).width = 300;
  flowTable.columns.get(3).width = 320;
  flowTable.columns.get(4).width = 240;
  flowTable.columns.get(5).width = 620;
  const tableValues = [
    ["Stage", "Tool / Component", "Input", "Output", "Included In", "Why It Matters"],
    ["Compile", "JDK + javac", "Main.java source code", "Main.class bytecode", "JDK", "Checks code and creates portable bytecode."],
    ["Run", "JRE + JVM", "Bytecode", "Machine-level output", "JRE / JDK", "Same bytecode runs on any OS with a JVM."],
  ];
  for (let row = 0; row < tableValues.length; row += 1) {
    for (let col = 0; col < tableValues[row].length; col += 1) {
      flowTable.cells.set(row, col, tableValues[row][col]);
    }
  }
  flowTable.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: 6 }).assign({
    textStyle: { typeface: "Times New Roman", fontSize: 28, bold: true, color: BLACK },
    anchor: "middle",
  });
  flowTable.cells.block({ row: 1, column: 0, rowCount: 2, columnCount: 6 }).assign({
    textStyle: { typeface: "Calibri", fontSize: 23, color: BLACK },
    anchor: "middle",
    margins: { left: 10, right: 10, top: 6, bottom: 6 },
  });

  setTextBox(presentation, "sh/yhkbe1o7", "Core Java", {
    typeface: "Calibri",
    fontSize: 64,
    bold: true,
    color: BLACK,
    alignment: "center",
  });
  addPanel(s5, "code-sample-panel", { left: 120, top: 220, width: 760, height: 530 });
  addText(s5, "code-sample-heading", "Basic Program Structure", { left: 160, top: 255, width: 680, height: 44 }, {
    fontSize: 34,
    bold: true,
    color: PURPLE,
  });
  addText(s5, "java-code-sample", 'class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, Java!");\n  }\n}', {
    left: 165,
    top: 330,
    width: 675,
    height: 185,
  }, {
    typeface: "Consolas",
    fontSize: 22,
    color: BLACK,
    lineSpacing: 1.05,
  });
  addBulletList(s5, "structure-bullets", [
    "Program execution starts from main().",
    "Variables store typed values such as int, double, char, boolean and String.",
    "Methods package reusable actions; arrays store multiple values of one type.",
  ], { left: 160, top: 545, width: 680, height: 165 }, { fontSize: 27 });
  addLabel(s5, "oop-label", "Object-Oriented Programming", 980, 245, 740);
  addBulletList(s5, "oop-bullets", [
    [{ run: "Class: ", textStyle: { bold: true } }, "blueprint used to create objects."],
    [{ run: "Object: ", textStyle: { bold: true } }, "real instance of a class."],
    [{ run: "Encapsulation: ", textStyle: { bold: true } }, "protects data inside a class."],
    [{ run: "Inheritance: ", textStyle: { bold: true } }, "reuses properties and methods."],
    [{ run: "Polymorphism: ", textStyle: { bold: true } }, "one action, many forms."],
    [{ run: "Abstraction: ", textStyle: { bold: true } }, "shows essentials and hides details."],
  ], { left: 980, top: 315, width: 800, height: 390 }, { fontSize: 30 });
  addText(s5, "control-flow-line", "Control flow: if-else and switch make decisions; for, while, do-while and for-each repeat tasks.", {
    left: 980,
    top: 760,
    width: 800,
    height: 95,
  }, { fontSize: 30, bold: true, color: ORANGE, alignment: "center" });

  const conclusionTitle = setTextBox(presentation, "sh/zi98nu94", "Conclusion", {
    typeface: "Calibri",
    fontSize: 64,
    bold: true,
    color: BLACK,
    alignment: "center",
  });
  conclusionTitle.position = { left: 660, top: 165, width: 600, height: 86 };
  addText(s6, "conclusion-thesis", "Java is a complete development platform for learning programming fundamentals and building real-world applications.", {
    left: 220,
    top: 270,
    width: 1480,
    height: 90,
  }, { fontSize: 38, bold: true, color: PURPLE, alignment: "center" });
  addLabel(s6, "applications-label", "Applications", 210, 390, 420);
  addBulletList(s6, "applications-bullets", [
    "Android, desktop, web and backend development.",
    "Banking, e-commerce, enterprise and cloud systems.",
    "Big-data tools, IoT, scientific apps and DSA practice.",
  ], { left: 210, top: 455, width: 690, height: 250 }, { fontSize: 30 });
  addLabel(s6, "advantages-label", "Advantages", 1030, 390, 420);
  addBulletList(s6, "advantages-bullets", [
    "Portable, secure, robust and object-oriented.",
    "Automatic garbage collection and strong exception handling.",
    "Large community, libraries, frameworks and tools.",
  ], { left: 1030, top: 455, width: 690, height: 250 }, { fontSize: 30 });
  addText(s6, "limitations-note", "Limitations: Java can use more memory than low-level languages, and its syntax can be lengthy for small tasks.", {
    left: 260,
    top: 785,
    width: 1400,
    height: 70,
  }, { fontSize: 30, color: BLACK, alignment: "center" });
  addText(s6, "thank-you-small", "Thank You!", {
    left: 690,
    top: 885,
    width: 540,
    height: 60,
  }, { fontSize: 38, bold: true, color: ORANGE, alignment: "center" });

  const notes = [
    "Java is one of the most popular programming languages in the world. It is widely used because it is secure, reliable, platform-independent, and suitable for both beginners and professional developers.",
    "This presentation explains Java through its purpose, execution model, program structure, object-oriented features, control flow and common applications.",
    "Java programs can run on different operating systems because source code is compiled into bytecode that the JVM executes.",
    "The JVM is the main reason Java is platform-independent. We compile the Java program once, and the generated bytecode can run on any operating system containing a compatible JVM.",
    "Every Java application starts execution from the main method. Variables store information, data types define the kind of information stored, and OOP helps organize reusable code.",
    "To conclude, Java is not only a programming language but also a complete development platform. Its portability, security, object-oriented structure and wide industry usage make it useful for students and professional developers.",
  ];
  for (const [index, note] of notes.entries()) {
    const inspected = await presentation.inspect({ kind: "notes", target: { id: presentation.slides.items[index].id }, maxChars: 500 });
    const noteLine = inspected.ndjson.split(/\r?\n/).find((line) => line.includes('"kind":"notes"'));
    if (noteLine) {
      const record = JSON.parse(noteLine);
      const noteObj = presentation.resolve(record.id);
      noteObj.setText(note);
    }
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(qaDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text(), "utf8");
  }
  await writeBlob(path.join(qaDir, "montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  await fs.writeFile(path.join(qaDir, "inspect-after.ndjson"), (await presentation.inspect({
    kind: "slide,textbox,shape,table,notes,layout",
    maxChars: 200000,
  })).ndjson, "utf8");

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  console.log(`Saved ${outputPptx}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
