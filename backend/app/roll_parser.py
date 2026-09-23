import re
from typing import Dict, Any, Optional

CURRENT_ACADEMIC_YEAR = 2026

# Branch mappings
BTECH_BRANCHES = {
    "02": ("EEE", "Electrical & Electronics Engineering"),
    "03": ("ME", "Mechanical Engineering"),
    "04": ("ECE", "Electronics & Communication Engineering"),
    "05": ("CSE", "Computer Science & Engineering"),
    "42": ("CSM", "CSE (AI & ML)"),
    "44": ("CSD", "CSE (Data Science)"),
}

DIPLOMA_BRANCHES = {
    "CM": "Computer Engineering",
    "EC": "Electronics & Communication",
    "EE": "Electrical & Electronics",
    "M": "Mechanical Engineering",
}

def parse_roll_number(roll_number: str, current_year: int = CURRENT_ACADEMIC_YEAR) -> Dict[str, Any]:
    clean_roll = roll_number.strip().upper()
    
    # 1. B.Tech Regular (YY811Abbnn) or Lateral Entry (YY815Abbnn)
    btech_match = re.match(r"^(\d{2})81([15])A(\d{2})\w{2}$", clean_roll)
    if btech_match:
        yy_str, entry_code, branch_code = btech_match.group(1), btech_match.group(2), btech_match.group(3)
        adm_year = 2000 + int(yy_str)
        is_lateral = (entry_code == "5")
        
        if is_lateral:
            year_of_study = (current_year - adm_year) + 2
            entry_type = "lateral entry"
        else:
            year_of_study = (current_year - adm_year) + 1
            entry_type = "regular"
            
        branch_info = BTECH_BRANCHES.get(branch_code, (branch_code, f"Branch {branch_code}"))
        branch_short = branch_info[0]
        
        # Determine bucket
        if 1 <= year_of_study <= 4:
            bucket = f"B{year_of_study}"
        else:
            bucket = f"B{min(max(year_of_study, 1), 4)}"
            
        is_new_admission = (adm_year == current_year)
        
        return {
            "valid": True,
            "course": "UG",
            "program": "B.Tech",
            "branch": branch_short,
            "branch_full": branch_info[1],
            "year_of_study": year_of_study,
            "entry_type": entry_type,
            "bucket": bucket,
            "admission_year": adm_year,
            "show_acc_reference": is_new_admission,
            "formatted_summary": f"B.Tech, {branch_short}, {entry_type}, {ordinal(year_of_study)} year -> bucket {bucket}"
        }

    # 2. Diploma (YY597-BB-nnn or YY597BBnnn)
    diploma_match = re.match(r"^(\d{2})597-?([A-Z]{1,2})-?\d{3,4}$", clean_roll)
    if diploma_match:
        yy_str, branch_code = diploma_match.group(1), diploma_match.group(2)
        adm_year = 2000 + int(yy_str)
        year_of_study = (current_year - adm_year) + 1
        
        branch_name = DIPLOMA_BRANCHES.get(branch_code, branch_code)
        bucket = "B5"
        is_new_admission = (adm_year == current_year)
        
        return {
            "valid": True,
            "course": "Diploma",
            "program": "Polytechnic",
            "branch": branch_code,
            "branch_full": branch_name,
            "year_of_study": year_of_study,
            "entry_type": "regular",
            "bucket": bucket,
            "admission_year": adm_year,
            "show_acc_reference": is_new_admission,
            "formatted_summary": f"Diploma, {branch_name}, {ordinal(year_of_study)} year -> bucket {bucket}"
        }

    # 3. Postgraduate / Custom pattern fallback
    return {
        "valid": False,
        "course": "PG",
        "program": "PG",
        "branch": "Various",
        "year_of_study": 1,
        "entry_type": "regular",
        "bucket": "PG",
        "admission_year": current_year,
        "show_acc_reference": True,
        "formatted_summary": "PG Player (No squad requirement)"
    }

def ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return f"{n}{suffix}"
