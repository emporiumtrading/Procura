"""
Proposal Generator
AI-powered proposal section generation for government contract opportunities.
Uses the multi-provider LLMClient with company profile context.
"""
from typing import Optional
import structlog

from .llm_client import LLMClient

logger = structlog.get_logger()

# ── Section prompt templates ──────────────────────────────────────────────────

_TECHNICAL_APPROACH_PROMPT = """You are a government contract proposal writer for {company_name}.

**Opportunity Details:**
- Title: {title}
- Agency: {agency}
- Description: {description}
- NAICS Code: {naics_code}
- Estimated Value: {estimated_value}
- Due Date: {due_date}

**Company Profile:**
- Capabilities: {capabilities}
- NAICS Codes: {naics_codes}
- Certifications: {certifications}
- Keywords/Specializations: {keywords}

Write a compelling **Technical Approach** section for this proposal (600-900 words).

Requirements:
- Demonstrate deep understanding of the agency's mission and requirements
- Describe your specific methodology and how it addresses the solicitation
- Highlight relevant technical capabilities, tools, and processes
- Reference specific past experience that is directly applicable
- Use active voice and confident, professional language
- Structure with clear subsections: Understanding of Requirements, Technical Solution, Tools & Technologies, Quality Assurance
- Avoid generic language — be specific to THIS opportunity and YOUR company

Output ONLY the proposal section text, no preamble."""

_MANAGEMENT_PLAN_PROMPT = """You are a government contract proposal writer for {company_name}.

**Opportunity Details:**
- Title: {title}
- Agency: {agency}
- Description: {description}
- Estimated Value: {estimated_value}

**Company Profile:**
- Company Name: {company_name}
- Capabilities: {capabilities}
- Keywords/Specializations: {keywords}

Write a **Management Plan** section for this proposal (400-600 words).

Requirements:
- Describe the organizational structure and key roles
- Explain your project management methodology (Agile, PMBOK, etc.)
- Include communication plan with the agency (meetings, reporting cadence)
- Address risk management approach
- Mention staffing approach and relevant experience levels
- Be specific to the contract scope and value

Output ONLY the proposal section text, no preamble."""

_PAST_PERFORMANCE_PROMPT = """You are a government contract proposal writer for {company_name}.

**Opportunity Details:**
- Title: {title}
- Agency: {agency}
- NAICS Code: {naics_code}
- Description: {description}

**Company's Past Performance:**
{past_performance_text}

**Capabilities & Keywords:**
{capabilities}

Write a **Past Performance** section for this proposal (400-600 words).

Requirements:
- Select and highlight the 2-3 most relevant past contracts
- For each, describe: scope, agency, performance period, dollar value, and key results/outcomes
- Draw explicit parallels between past work and THIS opportunity's requirements
- If past performance data is limited, focus on transferable capabilities and relevant experience
- Use metrics and measurable outcomes where possible

Output ONLY the proposal section text, no preamble."""

_COVER_LETTER_PROMPT = """You are a government contract proposal writer for {company_name}.

**Opportunity Details:**
- Solicitation: {external_ref}
- Title: {title}
- Agency: {agency}
- Due Date: {due_date}
- Estimated Value: {estimated_value}

**Company Profile:**
- Company Name: {company_name}
- CAGE Code: {cage_code}
- UEI: {uei_number}
- Certifications: {certifications}
- Set-Aside Eligibility: {set_aside_types}
- Location: {location}

Write a professional **Cover Letter** for this proposal (250-350 words).

Requirements:
- Professional business letter format
- Express interest and summarize why your company is uniquely qualified
- Reference the solicitation number and title explicitly
- Mention relevant certifications and set-aside eligibility if applicable
- Include a clear value proposition
- End with a call to action

Output ONLY the cover letter text, no preamble."""

_EXECUTIVE_SUMMARY_PROMPT = """You are a government contract proposal writer for {company_name}.

**Opportunity Details:**
- Title: {title}
- Agency: {agency}
- Description: {description}
- Estimated Value: {estimated_value}

**Company Profile:**
- Company Name: {company_name}
- Certifications: {certifications}
- Key Capabilities: {capabilities}
- Keywords: {keywords}

Write a compelling **Executive Summary** for this proposal (200-300 words).

Requirements:
- Capture the evaluator's attention immediately
- State clearly what you're offering and why you're the best choice
- Reference the agency's mission and how your solution advances it
- Highlight 2-3 key differentiators (not generic claims — be specific)
- Keep it concise and easy to skim

Output ONLY the executive summary text, no preamble."""


# ── Helper ────────────────────────────────────────────────────────────────────

def _format_past_performance(entries: list) -> str:
    if not entries:
        return "No formal past performance entries on file. (Company will describe relevant transferable experience.)"
    lines = []
    for e in entries[:4]:  # cap at 4 entries
        line = f"• {e.get('title', 'Contract')} | {e.get('agency', 'Agency')} | "
        if e.get("value"):
            line += f"${e['value']:,.0f} | "
        if e.get("period"):
            line += f"{e['period']} | "
        if e.get("description"):
            line += e["description"][:200]
        lines.append(line)
    return "\n".join(lines)


def _opp_context(opportunity: dict) -> dict:
    """Extract and normalise opportunity fields for prompts."""
    return {
        "title": opportunity.get("title", "N/A"),
        "agency": opportunity.get("agency", "Federal Agency"),
        "description": (opportunity.get("description") or opportunity.get("ai_summary") or "")[:800],
        "naics_code": opportunity.get("naics_code", "541511"),
        "external_ref": opportunity.get("external_ref", "N/A"),
        "estimated_value": (
            f"${opportunity['estimated_value']:,.0f}"
            if opportunity.get("estimated_value")
            else "Not specified"
        ),
        "due_date": opportunity.get("due_date", "N/A"),
    }


def _profile_context(profile: dict) -> dict:
    """Extract and normalise company profile fields for prompts."""
    return {
        "company_name": profile.get("company_name") or "Our Company",
        "cage_code": profile.get("cage_code") or "N/A",
        "uei_number": profile.get("uei_number") or "N/A",
        "naics_codes": ", ".join(profile.get("naics_codes") or []) or "541511",
        "certifications": ", ".join(profile.get("certifications") or []) or "None on file",
        "set_aside_types": ", ".join(profile.get("set_aside_types") or []) or "Full & Open",
        "capabilities": (profile.get("capabilities") or "")[:600] or "IT services, software development",
        "keywords": ", ".join(profile.get("keywords") or []) or "technology, software, cloud",
        "location": profile.get("primary_location") or "United States",
        "past_performance_text": _format_past_performance(profile.get("past_performance") or []),
    }


# ── Public API ────────────────────────────────────────────────────────────────

SECTION_NAMES = ["cover_letter", "executive_summary", "technical_approach", "management_plan", "past_performance"]


async def generate_section(
    section: str,
    opportunity: dict,
    profile: dict,
    provider: Optional[str] = None,
) -> str:
    """
    Generate a single proposal section using the configured LLM.
    Returns the generated text.
    """
    opp = _opp_context(opportunity)
    pro = _profile_context(profile)

    prompts = {
        "technical_approach": _TECHNICAL_APPROACH_PROMPT,
        "management_plan": _MANAGEMENT_PLAN_PROMPT,
        "past_performance": _PAST_PERFORMANCE_PROMPT,
        "cover_letter": _COVER_LETTER_PROMPT,
        "executive_summary": _EXECUTIVE_SUMMARY_PROMPT,
    }

    template = prompts.get(section)
    if not template:
        raise ValueError(f"Unknown section: {section}. Valid: {list(prompts.keys())}")

    prompt = template.format(**opp, **pro)

    llm = LLMClient(provider=provider)
    return await llm.complete(prompt, max_tokens=2048)


async def generate_full_proposal(
    opportunity: dict,
    profile: dict,
    sections: Optional[list] = None,
    provider: Optional[str] = None,
) -> dict:
    """
    Generate all (or selected) proposal sections sequentially.
    Returns dict mapping section name → generated text.
    """
    target_sections = sections or SECTION_NAMES
    results = {}

    for section in target_sections:
        try:
            logger.info("Generating proposal section", section=section, opportunity_id=opportunity.get("id"))
            text = await generate_section(section, opportunity, profile, provider=provider)
            results[section] = {"content": text, "status": "generated"}
        except Exception as e:
            logger.warning("Failed to generate section", section=section, error=str(e)[:200])
            results[section] = {"content": "", "status": "error", "error": str(e)[:200]}

    return results
