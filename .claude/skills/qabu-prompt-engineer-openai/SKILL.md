---
name: qabu-prompt-openai
description: Use when writing, reviewing, or improving any prompt for
  Qabû's chatbot that targets the gpt-oss-120b model.
disable-model-invocation: true
---

# Qabû Prompt Engineer (gpt-oss-120b)

## Target model
These rules apply to prompts written for OpenAI's gpt-oss-120b —
an open-weight reasoning model (MoE architecture, 117B parameters).
It is NOT a GPT model. It reasons internally before responding.

## Key characteristic of gpt-oss-120b
This is a reasoning model — treat it like a senior co-worker.
Give it a clear goal and trust it to figure out the details.
Do NOT over-specify every step. Do NOT prompt for chain-of-thought —
the model reasons internally already. Over-instructing can hurt output.

## Reasoning level — set in CODE, not in the prompt
The default is medium when nothing is set.
Setting "Reasoning: low" as text inside a system prompt does NOT work
reliably — it is ignored when running via vLLM or most inference servers.
The correct way is to pass it as an API parameter at call time:
```python
# OpenAI Responses API
reasoning={"effort": "low"}

# Chat completions / vLLM
reasoning_effort="low"
```

Recommended levels for Qabû:
- `low` — simple FAQ replies, opening hours, basic clinic info
- `medium` — multi-part questions, booking, complaints (default)
- `high` — complex medical queries, edge cases, escalations

When writing a prompt, note which reasoning level it is designed for
as a comment in the code, not inside the prompt itself.

## Prompt structure — always use this order
```
# Role and Objective

# Instructions

## Sub-sections for detailed rules

# Output Format

# Examples

# Context / Knowledge Base

# Final instruction (brief — one sentence maximum)
```

Place context and knowledge base NEAR THE END.
Keep the final instruction short — the model doesn't need hand-holding.

## Formatting — use Markdown

Use Markdown headers (`#`, `##`) for major sections.
Use numbered or bulleted lists for rules.
XML tags also work well for wrapping documents with metadata:
```xml
<doc id="1" title="Clinic Hours">We are open Sunday–Thursday 8am–6pm.</doc>
```

Do not mix Markdown and XML in the same prompt.

## Always use double-brace variables for dynamic content
{{BUSINESS_NAME}}, {{KNOWLEDGE_BASE}}, {{CHAT_HISTORY}}
Never hardcode values that change per clinic.

## Role definition
Always open with a clear role and objective:
```
# Role and Objective
You are a helpful customer support assistant for {{BUSINESS_NAME}}.
Answer patient questions using only the provided knowledge base,
in a warm and concise manner.
```

## Instructions section

State what TO do and what NOT to do.
Be clear but not exhaustive — the model will infer reasonable behavior.

- Specify tone concretely: "one to three sentences, warm but professional"
- Define fallback behavior explicitly — most common failure point
- Specify language: match the customer's language
- Add key negative constraints:
  - Never invent information not in the knowledge base
  - Never guess at medical details

## Fallback — never leave this undefined
Default when KB doesn't contain the answer:
"I don't have that information right now. Someone from our team
will follow up with you shortly."

## Grounding — when KB must be the only source
```
Only use the information in the provided knowledge base.
If the answer is not there, use the fallback message.
Do not use outside knowledge or make assumptions.
```

## Few-shot examples — include them
Place examples AFTER instructions and BEFORE context.
Use positive examples only — show what good looks like.
Keep example format consistent throughout.
```
# Examples

## Example 1
User: "What are your opening hours?"
Assistant: "We're open Sunday–Thursday 8am–6pm, and Friday 8am–2pm.
Is there anything else I can help you with?"

## Example 2
User: "Do you treat children?"
Assistant: "Yes, we see patients of all ages including children.
Would you like to book an appointment?"
```

## What NOT to do (reasoning model specific)

- Do NOT add "think step by step" — it already reasons internally
- Do NOT specify a detailed reasoning workflow — trust the model
- Do NOT use ALL CAPS for emphasis — plain language is enough
- Do NOT over-specify every micro-step — it will figure them out
- Do NOT set reasoning level inside the prompt text — it won't work

## Process — when asked to write or improve a prompt

1. Ask what the prompt is trying to achieve if unclear
2. Recommend the appropriate reasoning level for this use case
   (remind that it must be set in code, not in the prompt)
3. Check structure: Role → Instructions → Examples → Context
4. Check: are dynamic values using {{double_braces}}?
5. Check: is the fallback defined?
6. Check: is tone specified concretely?
7. Rewrite using the structure above
8. Explain each change in one sentence

## Quality checklist
- [ ] Reasoning level noted as a code comment (not in prompt text)
- [ ] Role and objective defined at the top
- [ ] Instructions clear but not over-specified
- [ ] Tone specified concretely
- [ ] Language instruction included
- [ ] Fallback behavior explicitly defined
- [ ] Negative constraints stated (what NOT to do)
- [ ] At least 1-3 positive few-shot examples
- [ ] Context / KB placed near the end
- [ ] Dynamic content uses {{double_braces}}
- [ ] No chain-of-thought prompting
- [ ] No ALL CAPS
