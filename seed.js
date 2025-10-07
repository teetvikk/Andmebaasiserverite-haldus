const mysql = require("mysql2/promise");
const { faker } = require("@faker-js/faker");

faker.seed(123); // fikseeritud seeme reprodutseeritavuseks

// Andmebaasi ühendus
(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "mariadb",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "student",
    password: process.env.DB_PASSWORD || "Passw0rd",
    database: process.env.DB_NAME || "tahvel",
  });

  // Helper funktsioon partiisisestuseks
  async function insertBatch(table, rows) {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const placeholders = rows.map(() => `(${keys.map(() => "?").join(",")})`).join(",");
    const values = rows.flatMap(row => keys.map(k => row[k]));
    await connection.execute(`INSERT INTO ${table} (${keys.join(",")}) VALUES ${placeholders}`, values);
  }

  // Users
  const userCount = 100_000;
  for (let i = 0; i < userCount; i += 5000) {
    const batch = Array.from({ length: Math.min(5000, userCount - i) }, () => ({
      username: faker.internet.userName() + "_" + (i + j),
      email: faker.internet.email(),
      password: faker.internet.password(),
      first_name: faker.name.firstName(),
      last_name: faker.name.lastName(),
      role: faker.helpers.arrayElement(["student", "teacher"]),
    }));
    await insertBatch("users", batch);
    console.log(`Inserted users: ${i + batch.length}/${userCount}`);
  }

  // Schools
  const schoolCount = 50;
  for (let i = 0; i < schoolCount; i++) {
    await insertBatch("schools", [{
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      city: faker.location.city(),
    }]);
  }

  // Classes
  const classCount = 500;
  for (let i = 0; i < classCount; i += 100) {
    const batch = Array.from({ length: Math.min(100, classCount - i) }, () => ({
      school_id: faker.number.int({ min: 1, max: schoolCount }),
      name: faker.word.words({ count: 2 }),
      year: faker.number.int({ min: 1, max: 12 }),
    }));
    await insertBatch("classes", batch);
  }

  // Subjects
  const subjects = ["Math", "History", "Physics", "Chemistry", "Estonian"];
  for (const name of subjects) {
    await insertBatch("subjects", [{ name }]);
  }

  // Assignments (peamine mitte-lookup tabel ≥ 2M)
  const assignmentCount = 2_000_000;
  for (let i = 0; i < assignmentCount; i += 5000) {
    const batch = Array.from({ length: Math.min(5000, assignmentCount - i) }, () => ({
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      creator_id: faker.number.int({ min: 1, max: userCount }),
      class_id: faker.number.int({ min: 1, max: classCount }),
      subject_id: faker.number.int({ min: 1, max: subjects.length }),
      due_date: faker.date.future({ years: 1 }).toISOString().slice(0, 19).replace("T", " "),
    }));
    await insertBatch("assignments", batch);
    if ((i / 5000) % 20 === 0) console.log(`Inserted assignments: ${i + batch.length}/${assignmentCount}`);
  }

  console.log("Seeder valmis! Kõik tabelid on täidetud.");
  await connection.end();
})();
