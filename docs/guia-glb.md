# Guia: preparar e exportar modelos GLB (provador virtual)

O provador posiciona o `.glb` do produto sobre o rosto detectado pela IA.
Para o encaixe ser realista **sem ajuste manual**, siga as convenções abaixo
(Blender como exemplo — o fluxo vale para qualquer DCC com exportador glTF).

## 1. Especificação técnica obrigatória

| Item | Especificação |
|---|---|
| Formato | `.glb` (glTF 2.0 binário, único arquivo) |
| Unidade | **metros** (1 unidade = 1 m; confira as Scene Units do DCC) |
| Escala física | Largura total da armação ≈ **0,14 – 0,16 m** |
| Origem | **Centro da ponte do nariz** (0,0,0 exatamente na ponte) |
| Orientação | **Hastes alinhadas ao eixo Z**; frente dos óculos apontada para **−Z** (para a câmera); **Y acima** |
| Texturas | até **1024×1024 px**; JPEG/PNG; UV otimizado |
| Polycount | até ~10k triângulos (detalhe desnecessário some a 30 cm do olho) |
| Tamanho | **≤ 2 MB** (ideal 300–800 KB). O admin alerta acima do recomendado |
| Compressão | **Draco** ou **Meshopt** (extensões suportadas pelo loader) |
| Materiais | PBR simples (Base Color + Metal/Rough). Evite KHR_materials exóticos |

## 2. Fluxo no Blender (resumo)

1. **Modelar centrado no eixo**: par de lentes simétrico; ponte no (0, 0, 0).
2. Definir **Y up** e a frente dos óculos para **−Z** (em direção à câmera).
3. Aplicar transformações (`Ctrl+A` → All Transforms) antes de exportar.
4. Texturas reduzidas a ≤1024px; remover imagens não utilizadas.
5. Exportar: **File → Export → glTF 2.0 (.glb)** →
   - Limit to Selected Objects ✔
   - Geometry: Apply Modifiers ✔; compressão **Draco** ✔ (qualidade ~6)
   - Materials: manter PBR simples (Base Color + Roughness/Metallic)
6. Validar em https://github.com/KhronosGroup/glTF-Validator antes do upload.

## 3. Como o ajuste fino funciona

O admin (Fase 7) tem um visualizador onde você define por produto/variável:

- `scale` — multiplicador padrão (base 1.0);
- `offsetX/Y/Z` — correção de posição (metros);
- `rotX/Y/Z` — correção de rotação (radians).

Esses valores são gravados na tabela `Model3D` e aplicados no provador.
Dispensadamente, cada **variação de cor** pode ter seu próprio `.glb` com
a materialização própria (lentes escurecidas, molduras diferentes etc.).

## 4. Checklist antes de subir o modelo

- [ ] Origem na ponte do nariz (0,0,0)
- [ ] Hastes no eixo Z; frente para −Z; Y para cima
- [ ] Escala em metros (largura ~0,15)
- [ ] ≤ 2 MB (comprimido Draco/Meshopt)
- [ ] Texturas ≤1024px; lentes semitransparentes usando material com `alpha`
- [ ] Validado no glTF-Validator
- [ ] Teste no visualizador 3D do admin e "Testar no provador"
