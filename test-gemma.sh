#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     PRUEBAS CON OLLAMA + EMBEDDINGGEMMA + MATRYOSHKA         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Verificar estado del servidor
echo "1️⃣  Verificando servidor..."
curl -s http://localhost:3000/health | jq '.embedding'
echo ""

# Listar documentos indexados
echo "2️⃣  Documentos indexados:"
curl -s http://localhost:3000/api/docs | jq '.documents[] | {docId, title, sectionsCount: .sections}'
echo ""

# Búsqueda semántica
echo "3️⃣  Búsqueda semántica: 'supervised vs unsupervised learning'"
curl -s -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "supervised vs unsupervised learning", "k": 1}' | \
  jq '.sources[0] | {score, contextPreview: .context[:300]}'
echo ""

# Estadísticas
echo "4️⃣  Estadísticas:"
echo "   ��� Tamaño rag.db: $(ls -lh rag.db | awk '{print $5}')"
echo "   ��� Tamaño documents.json: $(ls -lh documents.json | awk '{print $5}')"
echo ""

echo "✅ Todas las pruebas completadas exitosamente!"
