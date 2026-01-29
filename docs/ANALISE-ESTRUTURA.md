# Análise de Estrutura - Kowork v2

**Data:** 2026-01-29
**Objetivo:** Comparar estrutura atual com convenções definidas nos AGENTS.md

---

## Resumo Executivo

O projeto está bem estruturado na parte de **API** (routers, schemas, db, pubsub). Os problemas estão concentrados em:
1. Pastas vazias/redundantes
2. Inconsistências entre AGENTS.md e implementação real
3. Falta de documentação no Tauri
4. Configuração de build incompleta

---

## Problemas Encontrados

### 🔴 Crítico

#### 1. `tauri.conf.json` - Build de Produção
**Arquivo:** `src-tauri/tauri.conf.json`

```json
"build": {
  "devUrl": "http://localhost:3000",
  "frontendDist": "http://localhost:3000"  // ❌ Problema
}
```

**Problema:** `frontendDist` aponta para localhost, mas em produção precisa apontar para os arquivos buildados.

**Solução:**
```json
"build": {
  "devUrl": "http://localhost:3000",
  "frontendDist": "../dist"
}
```

**Impacto:** App não vai funcionar quando buildado para distribuição.

---

### 🟡 Importante

#### 2. Pasta `src/front/` Redundante
**Local:** `src/front/`

**Problema:** Contém apenas `AGENTS.md` com convenções, mas nenhum código. O frontend real está em `src/routes/` e `src/components/`.

**Opções:**
- A) Remover a pasta e mover as convenções para `src/routes/AGENTS.md`
- B) Mover componentes/hooks de UI para `src/front/` conforme o AGENTS.md descreve

**Recomendação:** Opção A - a estrutura atual (routes + components) é mais simples e já funciona.

---

#### 3. Pasta `src/cli/` Vazia
**Local:** `src/cli/`

**Problema:** Só tem `AGENTS.md` definindo como a CLI deveria funcionar, mas sem implementação.

**Impacto:** A CLI é necessária para integração com AI Coding Agents (conforme ROADMAP).

**Solução:** Implementar ou remover a pasta até que seja necessária.

---

#### 4. Comentários no Código
**Arquivo:** `src/routes/_app.tsx`

```typescript
// Auth bypass - app roda local com SQLite
// TODO: remover bypass quando implementar auth real
```

**Problema:** AGENTS.md principal define "Comentários: proibidos".

**Solução:** Remover comentários, usar nomes descritivos ou documentar em AGENTS.md.

---

#### 5. Falta de `-utils/` nas Rotas
**Local:** `src/routes/_app/tarefas/`, `src/routes/_app/projetos/`, etc.

**Problema:** O `src/front/AGENTS.md` define que hooks específicos de página devem ficar em `-utils/`:
```
routes/app/vendas/
├── index.tsx
├── -components/
└── -utils/
    └── useSalesQuery.tsx
```

**Situação Atual:** Nenhuma rota tem pasta `-utils/`.

**Impacto:** Quando implementar queries específicas, não há lugar definido para colocá-las.

---

#### 6. Falta de AGENTS.md no Tauri
**Local:** `src-tauri/`

**Problema:** A pasta Tauri não tem documentação de convenções.

**Solução:** Criar `src-tauri/AGENTS.md` com:
- Propósito (wrapper leve, só shortcut + window + tray)
- Convenções de código Rust
- Como adicionar novos comandos

---

### 🟢 Menor

#### 7. Inconsistência `stores/` vs `store/`
**Arquivos:** 
- `AGENTS.md` principal: `src/stores/`
- `src/front/AGENTS.md`: `store/`

**Situação Atual:** Pasta é `src/stores/` (correto conforme principal)

**Solução:** Atualizar `src/front/AGENTS.md` para usar `stores/`.

---

#### 8. Falta de `common/` e `shared/` em Components
**Local:** `src/components/`

**Problema:** O `src/front/AGENTS.md` define:
```
components/
├── common/    # Atomic components
├── shared/    # Compound components
└── charts/    # Chart components
```

**Situação Atual:** Só existe `src/components/ui/` (shadcn).

**Análise:** A estrutura atual é mais simples e suficiente para o estágio atual. O AGENTS.md do front parece ter sido copiado de outro projeto (menciona "Attribute", "IdeaDetails").

**Recomendação:** Atualizar `src/front/AGENTS.md` para refletir a estrutura real ou remover o arquivo.

---

#### 9. ThemeToggle Fora do App Shell
**Arquivo:** `src/routes/__root.tsx`

**Problema:** O ThemeToggle está no `__root.tsx`, que é o layout raiz. Deveria estar no `app-shell.tsx` para ficar junto com a navegação do app.

**Impacto:** Menor - funciona, mas a organização não é ideal.

---

#### 10. Imports não utilizados
**Verificar:** Alguns arquivos podem ter imports não usados após refatorações.

**Solução:** Rodar `bun run oxlint` regularmente.

---

## Conformidade por Área

| Área | Status | Notas |
|------|--------|-------|
| **API (routers)** | ✅ Conforme | Router único, subrouters, PubSub funcionando |
| **API (schemas)** | ✅ Conforme | Zod para validação |
| **API (db)** | ✅ Conforme | Kysely + @lobomfz/db, um arquivo por tabela |
| **Routes** | ⚠️ Parcial | File-based ok, falta -utils/ |
| **Components** | ⚠️ Parcial | shadcn/ui ok, falta estrutura common/shared |
| **CLI** | ❌ Não implementado | Só AGENTS.md |
| **Tauri** | ⚠️ Parcial | Funciona, falta docs e build config |
| **Tipografia** | ✅ Conforme | Title/Text implementados |
| **Ícones** | ✅ Conforme | Só lucide-react |

---

## Ações Recomendadas

### Imediatas (antes de continuar desenvolvimento)

1. **Corrigir `tauri.conf.json`** - frontendDist para "../dist"
2. **Remover comentários** em `_app.tsx`
3. **Decidir sobre `src/front/`** - remover ou integrar

### Curto Prazo

4. **Criar `src-tauri/AGENTS.md`**
5. **Atualizar `src/front/AGENTS.md`** ou remover
6. **Criar pastas `-utils/`** nas rotas quando necessário

### Quando Implementar CLI

7. **Implementar CLI** em `src/cli/` seguindo o AGENTS.md

---

## Arquivos AGENTS.md - Status

| Arquivo | Status | Ação |
|---------|--------|------|
| `/AGENTS.md` | ✅ Atualizado | Manter |
| `/src/api/AGENTS.md` | ✅ Correto | Manter |
| `/src/api/db/AGENTS.md` | ✅ Correto | Manter |
| `/src/routes/AGENTS.md` | ✅ Correto | Manter |
| `/src/components/AGENTS.md` | ✅ Correto | Manter |
| `/src/cli/AGENTS.md` | ⚠️ Sem código | Manter para referência futura |
| `/src/front/AGENTS.md` | ❌ Desatualizado | Remover ou atualizar |
| `/src-tauri/AGENTS.md` | ❌ Não existe | Criar |

---

## Conclusão

A estrutura do projeto está **boa no backend** (API, DB, schemas) mas precisa de **ajustes no frontend e Tauri**. Os problemas são majoritariamente organizacionais, não funcionais.

**Prioridade:** Corrigir o `tauri.conf.json` antes de tentar buildar para produção.
