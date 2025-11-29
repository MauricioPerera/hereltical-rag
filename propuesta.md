Propuesta técnica: RAG jerárquico con SQLite + sqlite-vec + lowdb
1. Objetivo

Implementar un RAG ligero (“micro-stack”) donde:

Los embeddings viven en SQLite usando la extensión sqlite-vec.

La estructura jerárquica de los documentos (secciones, títulos, subtítulos) vive en JSON persistido con lowdb.

Cada vector representa una sección completa (unidad semántica), y está enlazado a esa sección por un node_id estable, no por offsets frágiles.

Se pueden hacer búsquedas jerárquicas por niveles (documento → H1 → H2 → …), y luego navegar padres/hijos/hermanos usando solo la estructura JSON (sin más búsquedas vectoriales).

2. Stack propuesto
2.1. Persistencia

lowdb (JSON store)

Guardará:

Árbol de secciones por documento (estructura completa).

Mapa nodes para acceso rápido a padres/hijos.

Es un JSON DB muy ligera para Node, con API simple basada en JS nativo y presets tipo JSONFilePreset para leer/escribir sobre archivos (db.json, documents.json, etc.). 
GitHub
+2
GitHub
+2

SQLite + sqlite-vec

SQLite: base relacional embebida (archivo rag.db).

sqlite-vec: extensión de búsqueda vectorial que permite crear tablas virtuales vec0 con columnas de vectores (float[n], int8, binario) y hacer KNN con MATCH y k. 
GitHub
+2
alexgarcia.xyz
+2

Ventajas:

Sin servidor, sin dependencias, corre donde corra SQLite (desktop, server, móviles, WASM, etc.). 
GitHub
+2
GitHub
+2

2.2. Runtime

Node.js (ESM) como runtime principal:

Módulo lowdb para JSON store. 
GitHub
+1

Módulo sqlite3 o better-sqlite3 + binding de sqlite-vec vía paquete npm sqlite-vec, que expone helpers para cargar la extensión en Node. 
GitHub
+1

Servicio de embeddings (OpenAI / local) abstraído en un módulo embeddings.ts.

3. Modelo de datos
3.1. JSON de documento (lowdb)

Archivo: documents.json

Estructura propuesta:

{
  "documents": [
    {
      "docId": "doc-123",
      "title": "Guía de Regularización",
      "version": 3,
      "root": {
        "id": "sec-root",
        "type": "document",
        "level": 0,
        "title": "Guía de Regularización",
        "content": [],
        "children": [
          {
            "id": "sec-1",
            "type": "section",
            "level": 1,
            "title": "Introducción",
            "content": [
              "La regularización es una técnica para evitar overfitting...",
              "En esta guía veremos L1 y L2..."
            ],
            "children": []
          },
          {
            "id": "sec-2",
            "type": "section",
            "level": 1,
            "title": "Regularización L2",
            "content": [],
            "children": [
              {
                "id": "sec-2-1",
                "type": "section",
                "level": 2,
                "title": "Definición",
                "content": [
                  "La regularización L2 agrega un término λ||w||² al loss..."
                ],
                "children": []
              },
              {
                "id": "sec-2-2",
                "type": "section",
                "level": 2,
                "title": "Implementación práctica",
                "content": [
                  "En la práctica, L2 suele implementarse como weight decay..."
                ],
                "children": []
              }
            ]
          }
        ]
      },
      "nodes": {
        "sec-root": {
          "id": "sec-root",
          "parentId": null,
          "childrenIds": ["sec-1", "sec-2"],
          "level": 0
        },
        "sec-1": {
          "id": "sec-1",
          "parentId": "sec-root",
          "childrenIds": [],
          "level": 1
        },
        "sec-2": {
          "id": "sec-2",
          "parentId": "sec-root",
          "childrenIds": ["sec-2-1", "sec-2-2"],
          "level": 1
        },
        "sec-2-1": {
          "id": "sec-2-1",
          "parentId": "sec-2",
          "childrenIds": [],
          "level": 2
        },
        "sec-2-2": {
          "id": "sec-2-2",
          "parentId": "sec-2",
          "childrenIds": [],
          "level": 2
        }
      }
    }
  ]
}


id de cada nodo (node_id) es el ancla estable que usará SQLite.

nodes permite navegar rápidamente:

Padre (parentId).

Hijos (childrenIds).

Hermanos = childrenIds del padre – node_id.

Lowdb se usaría así (ESM): 
GitHub

import { JSONFilePreset } from 'lowdb/node'

const defaultData = { documents: [] }
export const docsDb = await JSONFilePreset('documents.json', defaultData)

3.2. SQLite: tabla de secciones + tabla vectorial

Archivo: rag.db

3.2.1. Tabla sections

Metadatos por sección:

CREATE TABLE sections (
  rowid      INTEGER PRIMARY KEY, -- implícito, lo usamos como ID numérico
  node_id    TEXT UNIQUE NOT NULL, -- p.ej. "sec-2-2"
  doc_id     TEXT NOT NULL,        -- "doc-123"
  level      INTEGER NOT NULL,     -- 0,1,2,…
  title      TEXT,
  is_leaf    INTEGER NOT NULL,     -- 1 = hoja (se vectoriza), 0 = interna
  path       TEXT,                 -- JSON con ["Regularización L2", "Implementación práctica"]
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);


rowid se usa para enlazar con la tabla virtual de vectores (patrón recomendado: usar rowid como clave numérica para vec0). 
TIL
+1

3.2.2. Tabla virtual vec_sections (sqlite-vec)

Creación:

CREATE VIRTUAL TABLE vec_sections USING vec0(
  rowid INTEGER PRIMARY KEY,          -- debe ser entero
  embedding FLOAT[1536]               -- tamaño según embedding elegido
);


embedding puede ser FLOAT[n] según el modelo (p.ej. 768, 1536, etc.). 
TIL
+1

Se alimenta de uno en uno o en batch:

INSERT INTO sections (node_id, doc_id, level, title, is_leaf, path)
VALUES ('sec-2-2', 'doc-123', 2, 'Implementación práctica', 1, '["Regularización L2","Implementación práctica"]');

-- luego obtenemos last_insert_rowid() en la app:
-- const rowid = db.prepare('SELECT last_insert_rowid()').pluck().get();

INSERT INTO vec_sections(rowid, embedding)
VALUES (?, vec_f32(?));
-- ?1 = rowid, ?2 = JSON string con el vector ["0.01", "0.02", ...]


vec0 permite consultas KNN del estilo:

SELECT
  s.node_id,
  s.doc_id,
  v.distance
FROM vec_sections v
JOIN sections s ON s.rowid = v.rowid
WHERE v.embedding MATCH vec_f32(:query_vec_json)
  AND k = :k
ORDER BY v.distance;


Usando el patrón de MATCH + k que expone sqlite-vec para KNN. 
TIL
+2
alexgarcia.xyz
+2

4. Flujos clave
4.1. Indexado de un documento

Parsing

Input: Markdown/HTML/PDF → convertimos a un árbol de secciones con:

id (UUID o slug estable).

level, title, content[], children[].

Persistir JSON (lowdb)

Buscar si ya existe docId en documents.

Si no, insertar nuevo objeto documento con root + nodes.

Si existe, actualizar preservando id de secciones que conceptualmente siguen siendo las mismas (para estabilidad de node_id).

Calcular embeddings

Para cada nodo hoja:

section_text = content.join('\n')

embedding = embed(section_text) (servicio externo/local).

Opcional: para niveles H1/H2, también generar embeddings de título+resumen para búsquedas jerárquicas.

Actualizar SQLite

Para cada sección hoja:

INSERT OR REPLACE en sections.

Tomar rowid.

INSERT OR REPLACE en vec_sections(rowid, embedding).

4.2. Búsqueda jerárquica

Hay dos modos: plano (buscar solo en hojas) o jerárquico (documento → H1 → H2 → hoja). El segundo explota más tu diseño.

4.2.1. Paso a paso (modo jerárquico)

Embed de la query

const queryEmbedding = await embed(userQuery)
const queryJson = JSON.stringify(queryEmbedding)


Nivel documento (opcional)

SELECT
  s.doc_id,
  MIN(v.distance) AS best_distance
FROM vec_sections v
JOIN sections s ON s.rowid = v.rowid
WHERE s.level = 0          -- nodos "documento"
  AND v.embedding MATCH vec_f32(:query)
  AND k = :k_docs
GROUP BY s.doc_id
ORDER BY best_distance
LIMIT :max_docs;


Nivel H1 dentro de cada doc candidato

SELECT
  s.node_id,
  s.doc_id,
  v.distance
FROM vec_sections v
JOIN sections s ON s.rowid = v.rowid
WHERE s.doc_id = :doc_id
  AND s.level = 1
  AND v.embedding MATCH vec_f32(:query)
  AND k = :k_h1
ORDER BY v.distance;


Nivel hojas

Filtrar is_leaf = 1 y opcionalmente parent funcional (usando nodes en el JSON) para limitar a la subrama adecuada.

Alternativamente, hacer una sola búsqueda global en hojas:

SELECT
  s.node_id,
  s.doc_id,
  v.distance
FROM vec_sections v
JOIN sections s ON s.rowid = v.rowid
WHERE s.is_leaf = 1
  AND v.embedding MATCH vec_f32(:query)
  AND k = :k_leaf
ORDER BY v.distance;


Construcción de contexto (sin más KNN)

Para cada (node_id, doc_id) resultante:

Cargar documento desde lowdb:

const doc = docsDb.data.documents.find(d => d.docId === docId)
const nodeMeta = doc.nodes[nodeId]


Desde nodes:

parentId = nodeMeta.parentId

childrenIds = nodeMeta.childrenIds

siblings = doc.nodes[parentId].childrenIds.filter(id => id !== nodeId)

Desde el árbol (root):

Recuperar content y title de:

nodo principal (nodeId)

padre (parentId)

opcionales: algunos hijos/hermanos

Todo esto viene del JSON y no requiere tocar otra vez vec_sections.

4.3. Actualización de documentos

Cuando un documento cambia:

Detectar cambios de estructura

Si el parser puede conservar los mismos id para secciones que se mantienen conceptualmente:

El link node_id ↔ embedding se mantiene.

Estrategia de re-embedding

Si el cambio en texto de una sección es:

Menor → opcional re-embedding.

Mayor (cambio semántico) → recalcular embedding para ese node_id y actualizar fila en vec_sections.

Secciones nuevas / eliminadas

Nuevas: generar nuevo id, insertar en lowdb + SQLite.

Eliminadas: marcar sections como inactivas o borrar (y eliminar su fila en vec_sections).

De esta forma se evita reindexar todo el documento.

5. Módulos / capas sugeridas
5.1. jsonStore.ts (lowdb)

Responsable de:

loadDocument(docId)

saveDocument(docJson)

utilidades:

getNode(docId, nodeId)

getParent(docId, nodeId)

getChildren(docId, nodeId)

getSiblings(docId, nodeId)

5.2. vectorStore.ts (SQLite + sqlite-vec)

Responsable de:

Inicializar DB y cargar extensión sqlite-vec. 
GitHub
+1

upsertSectionMeta(sectionMeta) (inserta en sections).

upsertEmbedding(rowid, embedding).

searchKnn({ queryEmbedding, level?, isLeaf?, docId?, k }):

Construye la query KNN usada en los flujos de arriba.

5.3. indexer.ts

Orquestar:

parseo → JSON → lowdb

embeddings → SQLite

5.4. ragEngine.ts

answer(userQuery):

Embed query.

Ejecutar búsqueda jerárquica.

Recuperar contexto vía jsonStore.

Llamar al modelo LLM con ese contexto.

6. Plan de implementación incremental

Fase 1 – Happy path mínimo

Implementar:

documents.json + lowdb.

sections + vec_sections en SQLite.

Ingestar 1–2 documentos de prueba.

Hacer búsqueda KNN simple en hojas is_leaf = 1 y devolver texto de esa sección.

Fase 2 – Jerarquía y contexto

Completar nodes en JSON.

Implementar navegación padre/hijos/hermanos.

Construir contexto jerárquico (sección + padre + 1–2 hermanos).

Fase 3 – Búsqueda jerárquica por niveles

Añadir embeddings a nivel documento/H1.

Implementar pipeline: documento → H1 → hojas.

Fase 4 – Actualización & re-embedding

Estrategia de detección de cambios por sección.

Re-embedding selectivo + actualización de SQLite.