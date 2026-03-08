---
name: qabu-prompt-engineer-gemini
description: Use when writing, reviewing, or improving any prompt for
  Qabû's chatbot. Triggers on prompt creation, optimization, or when
  an existing prompt produces weak or inconsistent responses.
disable-model-invocation: true
---

# Qabû Prompt Engineer Gemini

## Target model
These rules apply to prompts written for Gemini models via the Gemini API.

## Structure — always use this order

1. Role / identity (who is the assistant)
2. Instructions / constraints (what to do and not do)
3. Context / knowledge base (long content goes HERE, not at the end)
4. Few-shot examples (if applicable)
5. Task / question (always at the very END)
6. Final instruction anchor (optional — e.g. "Based on the above...")

Gemini performs significantly better when context comes before the task.
Placing the question at the end can improve response quality by up to 30%.

## Formatting rules

Use XML tags OR Markdown headers — never mix both in the same prompt.
Be consistent throughout the entire prompt.

**XML format (preferred for structured prompts):**
```xml
<role>You are a customer support assistant for {{BUSINESS_NAME}}.</role>

<instructions>
- Reply only from the knowledge base
- Match the customer's language
- If answer not found, say so honestly
</instructions>

<knowledge_base>
{{KNOWLEDGE_BASE}}
</knowledge_base>

<chat_history>
{{CHAT_HISTORY}}
</chat_history>

<task>
Write the next support message.
</task>
```

**Markdown format (simpler prompts):**
```
## Role
You are a customer support assistant for {{BUSINESS_NAME}}.

## Instructions
- Reply only from the knowledge base
- Match the customer's language

## Knowledge Base
{{KNOWLEDGE_BASE}}

## Task
Write the next support message.
```

## Always use double-brace variables for dynamic content
{{BUSINESS_NAME}}, {{KNOWLEDGE_BASE}}, {{CHAT_HISTORY}}
Never hardcode values that change per clinic.

## Few-shot examples — always include them
Gemini's own docs say: prompts without examples are likely less effective.
Use positive examples (show what good looks like).
Never use negative examples (don't show what to avoid).
Keep example format identical to each other — consistent structure matters.

**Positive pattern:**
```
Input: "What are your opening hours?"
Output: "We're open Sunday–Thursday, 8am–6pm, and Friday 8am–2pm."
```

**Not this:**
```
Input: "What are your opening hours?"
Bad output: "I don't know our hours, you should check the website."
```

## Constraints — always define these explicitly

- What the bot should NOT do (never invent medical information)
- Length: specify concretely ("one to three sentences", not "be concise")
- Language: instruct the model to match the customer's language
- Fallback: what to say when the knowledge base has no answer

## Fallback — never leave this undefined
Default fallback to use when KB doesn't contain the answer:
"I don't have that information right now. I'll make sure someone from
our team follows up with you shortly."

## Grounding — use this in system instructions when KB must be the only source
```
Reply only using the information provided in the knowledge base.
Do not use your own knowledge. If the answer is not explicitly in the
knowledge base, state that the information is not available.
```

## Process — when asked to write or improve a prompt

1. Confirm: which Gemini model? (Flash, Pro, Gemini 3?)
2. Ask what the prompt is trying to achieve if unclear
3. Check: does it have role, constraints, context, examples, task — in that order?
4. Check: are dynamic values using {{double_braces}}?
5. Check: is the fallback defined?
6. Rewrite using the correct structure above
7. Explain each change in one sentence
8. Ask if few-shot examples should be added

## Quality checklist
- [ ] Role defined with {{BUSINESS_NAME}}
- [ ] Context/KB placed BEFORE the task
- [ ] Task/question at the very END
- [ ] XML or Markdown — not both
- [ ] Dynamic variables use {{double_braces}}
- [ ] At least 1-3 few-shot positive examples
- [ ] Fallback behavior explicitly defined
- [ ] Language instruction included
- [ ] Negative constraints stated (what NOT to do)
- [ ] Length specified concretely
