# CLAUDE.md

## Contexto do Projeto

Este é um projeto para o **Limas Atacado**. A proposta é criar um carrossel para um totem que seja configurável pelos próprios colaboradores do Limas, sem necessidade de intervenção técnica.

## Biblioteca de UI

**Sempre use componentes do [shadcn/ui](https://ui.shadcn.com) para elementos de interface.**

Nunca crie elementos HTML puros (`<button>`, `<input>`, `<dialog>`, etc.) quando existir um componente shadcn equivalente. Use sempre os componentes de `src/components/ui/`.

Componentes já instalados:

| Componente | Caminho |
|---|---|
| Button | `@/components/ui/button` |
| Input | `@/components/ui/input` |
| Label | `@/components/ui/label` |
| Card / CardHeader / CardContent | `@/components/ui/card` |
| Dialog / DialogContent / DialogHeader | `@/components/ui/dialog` |
| Badge | `@/components/ui/badge` |
| Table / TableHeader / TableBody / TableRow | `@/components/ui/table` |
| Progress | `@/components/ui/progress` |

Para instalar novos componentes:
```
pnpm dlx shadcn@latest add <nome>
```

---

## Regras de Git

**Nunca faça commits ou alterações diretamente na branch `main`.**

Sempre crie uma branch separada para qualquer mudança:

```
git checkout -b feature/nome-da-feature
# ou
git checkout -b fix/nome-do-fix
```

Abra um Pull Request para merge na `main`.
