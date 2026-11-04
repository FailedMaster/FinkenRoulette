export function parseCsvContent(csvText, separator = ";") {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const parseLine = (line) => {
    const values = [];
    let currentValue = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        values.push(currentValue);
        currentValue = "";
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue);
    return values;
  };

  const headers = parseLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseLine(line);

    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

export function isNumber(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  return !Number.isNaN(Number(value.replace(",", ".")));
}

export function isFlagSet(value) {
  return ["1", "true", "ja"].includes(String(value).trim().toLowerCase());
}

export async function loadBeers() {
  const [permanentResponse, seasonalResponse] = await Promise.all([
    fetch("/Bierkarte_dauerhaft.csv"),
    fetch("/Bierkarte_saisonal.csv"),
  ]);

  if (!permanentResponse.ok || !seasonalResponse.ok) {
    throw new Error(
      "Fehler beim Laden der Bierkarte. Bitte versuche es später erneut.",
    );
  }

  const [permanentCsv, seasonalCsv] = await Promise.all([
    permanentResponse.text(),
    seasonalResponse.text(),
  ]);
  const beers = [
    ...parseCsvContent(permanentCsv),
    ...parseCsvContent(seasonalCsv),
  ];

  if (beers.length === 0) {
    throw new Error("Die Bierkarte ist leer. Bitte überprüfe die CSV-Dateien.");
  }

  return beers;
}
