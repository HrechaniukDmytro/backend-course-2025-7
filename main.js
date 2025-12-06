const { program } = require('commander');
const express = require('express');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

program
  .requiredOption('-h, --host <type>', 'адреса сервера')
  .requiredOption('-p, --port <type>', 'порт сервера')
  .requiredOption('-c, --cache <type>', 'шлях до директорії кешу');

program.parse(process.argv);

const options = program.opts();

const HOST = options.host;
const PORT = parseInt(options.port, 10);
const CACHE_DIR = path.resolve(options.cache);

if (!fs.existsSync(CACHE_DIR))
{
  console.log(`Cache directory not found. Creating: ${CACHE_DIR}`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} 
else 
{
  console.log(`Using existing cache directory: ${CACHE_DIR}`);
}

const app = express();

app.use(express.static(path.join(__dirname, 'html-forms')));

const multer = require('multer');

const upload = multer({ dest: CACHE_DIR });

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

let inventory = [];
let nextId = 1;

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Зареєструвати нову річ
 *     description: Створює новий запис в інвентарі, приймаючи дані форми.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Ім'я речі (обов'язково)
 *                 example: Laptop
 *               description:
 *                 type: string
 *                 description: Опис речі
 *                 example: sdfdgsdf
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Файл фотографії
 *     responses:
 *       '201':
 *         description: Річ успішно створено. Повертає об'єкт речі.
 *       '400':
 *         description: Bad Request. Не надано 'inventory_name'.
 */
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  const photo = req.file; 

  if (!inventory_name) 
  {
    return res.status(400).send('Bad Request: inventory_name is required.');
  }

  const newItem = 
  {
    id: nextId++,
    name: inventory_name,
    description: description || '',
    photo: photo ? path.resolve(photo.path) : null 
  };

  inventory.push(newItem);
  console.log('New item registered:', newItem);
  res.status(201).json(newItem);
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Перегляд списку речей
 *     description: Повертає JSON-масив усіх інвентаризованих речей.
 *     tags: [Inventory]
 *     responses:
 *       '200':
 *         description: Успішна відповідь. Повертає масив речей.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   name:
 *                     type: string
 *                     example: Laptop
 *                   description:
 *                     type: string
 *                     example: 16GB RAM, 1TB SSD
 *                   photo:
 *                     type: string
 *                     example: /path/to/cache/file
 *                   photo_url:
 *                     type: string
 *                     example: /inventory/1/photo
 */
app.get('/inventory', (req, res) => {
  const inventoryWithLinks = inventory.map(item => ({
    ...item,
    photo_url: item.photo ? `/inventory/${item.id}/photo` : null
  }));
  res.status(200).json(inventoryWithLinks);
});
 
/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати інформацію про річ
 *     description: Повертає JSON-об'єкт речі за її унікальним ID.
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Унікальний ID речі
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Успішна відповідь. Повертає об'єкт речі.
 *       '404':
 *         description: Not Found. Річ з таким ID не знайдено.
 */
app.get('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === itemId);

  if (!item) 
  {
    return res.status(404).send('Not Found');
  }

  const itemWithLink = {...item,photo_url: item.photo ? `/inventory/${item.id}/photo` : null};
  res.status(200).json(itemWithLink);
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Оновити ім'я або опис речі
 *     description: Оновлює текстові дані речі (ім'я та/або опис).
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Унікальний ID речі
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: New Laptop Name
 *               description:
 *                 type: string
 *                 example: New description
 *     responses:
 *       '200':
 *         description: Успішно оновлено. Повертає оновлений об'єкт.
 *       '404':
 *         description: Not Found. Річ з таким ID не знайдено.
 */
app.put('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === itemId);

  if (!item) 
  {
    return res.status(404).send('Not Found');
  }
  if (req.body.name) 
  {
    item.name = req.body.name;
  }
  if (req.body.description) 
  {
    item.description = req.body.description;
  }

  res.status(200).json(item);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото речі
 *     description: Повертає файл зображення (фото) для речі за її ID.
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Унікальний ID речі
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Успішна відповідь. Повертає файл зображення.
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       '404':
 *         description: Not Found. Річ або фото не знайдено.
 */
app.get('/inventory/:id/photo', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === itemId);

  if (!item || !item.photo || !fs.existsSync(item.photo)) 
  {
    return res.status(404).send('Not Found');
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(item.photo); 
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фото речі
 *     description: Замінює існуюче фото новим файлом.
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Унікальний ID речі
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Новий файл фотографії
 *     responses:
 *       '200':
 *         description: Фото успішно оновлено.
 *       '400':
 *         description: Bad Request. Файл фото не надано.
 *       '404':
 *         description: Not Found. Річ з таким ID не знайдено.
 */
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const item = inventory.find(i => i.id === itemId);

  if (!item) 
  {
    return res.status(404).send('Not Found');
  }

  if (req.file) 
  {
    if (item.photo && fs.existsSync(item.photo)) 
    {
      fs.unlinkSync(item.photo);
    }
    item.photo = path.resolve(req.file.path); 
    res.status(200).send('Photo updated successfully.');
  } 
  else 
  {
    res.status(400).send('Bad Request: No photo file provided.');
  }
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Видалити річ
 *     description: Видаляє річ із системи за її унікальним ID.
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Річ успішно видалено.
 *       '404':
 *         description: Not Found. Річ з таким ID не знайдено.
 */
app.delete('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id, 10);
  const itemIndex = inventory.findIndex(i => i.id === itemId);

  if (itemIndex === -1) 
  {
    return res.status(404).send('Not Found');
  }

  const [deletedItem] = inventory.splice(itemIndex, 1);

  if (deletedItem.photo && fs.existsSync(deletedItem.photo)) 
  {
    fs.unlinkSync(deletedItem.photo);
  }
  res.status(200).send('Item deleted successfully.');
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук речі за ID
 *     description: Обробляє пошук пристрою за ID. Приймає дані у форматі x-www-form-urlencoded.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 description: ID речі для пошуку
 *                 example: 1
 *               includePhoto:
 *                 type: string
 *                 description: Якщо "on", додає посилання на фото
 *                 example: on
 *     responses:
 *       '200':
 *         description: Успішний пошук.
 *       '404':
 *         description: Not Found. Річ з таким ID не знайдено.
 */
app.post('/search', (req, res) => {
  const { id, includePhoto } = req.body; 
  const itemId = parseInt(id, 10);
  const item = inventory.find(i => i.id === itemId);

  if (!item) 
  {
    return res.status(404).send('Not Found');
  }

  const result = { ...item };
  
  if (includePhoto === 'on' && result.photo) 
  {
    result.description += ` [Photo Link: /inventory/${result.id}/photo]`;
  }

  res.status(200).json(result);
});

const swaggerOptions = {
  definition: 
    {
    openapi: '3.0.0',
    info: 
    {
      title: 'Lab 6',
      version: '1.0.0',
      description: 'API documentation for the Inventory Service from backend-course-2025-6',
    },
    servers: 
    [
      {
        url: `http://${HOST}:${PORT}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./main.js'], 
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`Access registration form at http://${HOST}:${PORT}/RegisterForm.html`);
  console.log(`Access search form at http://${HOST}:${PORT}/SearchForm.html`);
});