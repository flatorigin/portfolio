from decimal import Decimal, ROUND_CEILING

from rest_framework.exceptions import ValidationError

from .estimators import _decimal, _money, _money_string, _number_string, _clean_list, _signed_decimal


NUMBERS = {
    'wall_area': 0, 'ceiling_area': 0, 'wall_length': 0, 'height': 8,
    'length': 0, 'width': 0, 'opening_area': 0, 'layers': 1,
    'sheet_width': 4, 'sheet_height': 8, 'waste': 10,
    'sheet_price': 0, 'supplies': 0, 'hanging_rate': 0, 'finishing_rate': 0,
    'installed_rate': 0, 'access_percent': 0, 'removal_rate': 0,
    'patch_count': 0, 'patch_rate': 0,
}
CHOICES = {
    'measurement': ('measured', 'dimensions'), 'pricing': ('separate', 'installed'),
    'material_supplier': ('contractor', 'client'), 'finish': ('0', '1', '2', '3', '4', '5'),
}


def calculate_drywall_estimate(raw):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 sections.'})
    normalized, results = [], []
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            raise ValidationError({'sections': 'Each section must be an object.'})
        section = {key: str(item.get(key, default)).strip()[:200] for key, default in {
            'id': str(index), 'name': 'Drywall section', 'board_type': 'Standard gypsum', 'thickness': '1/2 in',
        }.items()}
        for key, choices in CHOICES.items():
            section[key] = item.get(key, choices[0])
            if section[key] not in choices:
                raise ValidationError({key: 'Choose a valid option.'})
        for key, default in NUMBERS.items():
            minimum = Decimal('0.01') if key in ('sheet_width', 'sheet_height', 'height') else Decimal('1') if key == 'layers' else Decimal('0')
            maximum = Decimal('100') if key in ('waste', 'access_percent') else Decimal('5') if key == 'layers' else Decimal('100000')
            value = _decimal(item.get(key, default), key, minimum=minimum, maximum=maximum)
            if key in ('layers', 'patch_count') and value != value.to_integral_value():
                raise ValidationError({key: 'Enter a whole number.'})
            section[key] = _number_string(value)
        for key, default in {'walls': True, 'ceilings': False, 'deduct_material': True, 'deduct_labor': False}.items():
            if not isinstance(item.get(key, default), bool):
                raise ValidationError({key: 'Expected true or false.'})
            section[key] = item.get(key, default)
        n = lambda key: Decimal(section[key])
        walls = (n('wall_area') if section['measurement'] == 'measured' else n('wall_length') * n('height')) if section['walls'] else Decimal('0')
        ceiling = (n('ceiling_area') if section['measurement'] == 'measured' else n('length') * n('width')) if section['ceilings'] else Decimal('0')
        if n('opening_area') > walls:
            raise ValidationError({'opening_area': 'Opening area cannot exceed wall area.'})
        gross = walls + ceiling
        net = gross - (n('opening_area') if section['deduct_material'] else 0)
        labor_area = gross - (n('opening_area') if section['deduct_labor'] else 0)
        purchase = net * n('layers') * (1 + n('waste') / 100)
        sheets = int((purchase / (n('sheet_width') * n('sheet_height'))).to_integral_value(rounding=ROUND_CEILING))
        lines = []
        def add(name, quantity, rate, unit):
            lines.append({'name': name, 'quantity': _number_string(Decimal(quantity)), 'rate': _money_string(Decimal(rate)), 'unit': unit, 'amount': _money_string(Decimal(quantity) * Decimal(rate))})
        if section['pricing'] == 'installed':
            add('Installed drywall (all included work)', labor_area, n('installed_rate'), 'sq ft')
        else:
            if section['material_supplier'] == 'contractor':
                add('Drywall sheets', sheets, n('sheet_price'), 'sheet')
                add('Tape, compound, screws and bead allowance', 1, n('supplies'), 'allowance')
            hanging = _money(labor_area * n('layers') * n('hanging_rate'))
            finishing = _money(labor_area * n('finishing_rate'))
            add('Hanging labor', labor_area * n('layers'), n('hanging_rate'), 'sq ft')
            add('Finishing labor', labor_area, n('finishing_rate'), 'sq ft')
            add('Access labor adjustment', 1, _money((hanging + finishing) * n('access_percent') / 100), 'allowance')
        add('Existing drywall removal', gross, n('removal_rate'), 'sq ft')
        add('Patch repairs', n('patch_count'), n('patch_rate'), 'patch')
        normalized.append(section)
        results.append({'name': section['name'], 'gross_area': _number_string(gross), 'net_area': _number_string(net), 'purchase_area': _number_string(purchase), 'sheets': sheets, 'line_items': lines, 'subtotal': _money_string(sum((Decimal(line['amount']) for line in lines), Decimal('0')))})
    inputs = {'sections': normalized}
    for key in ('prepared_by', 'client_name', 'project_location', 'notes'):
        inputs[key] = str(raw.get(key, '')).strip()[:2000]
    for key in ('included_scope', 'excluded_scope'):
        inputs[key] = _clean_list(raw.get(key), key)
    for key, choices in {'profit_method': ('markup', 'margin'), 'discount_type': ('percent', 'fixed'), 'output_preference': ('detailed', 'summary')}.items():
        inputs[key] = raw.get(key, choices[0])
        if inputs[key] not in choices:
            raise ValidationError({key: 'Choose a valid option.'})
    for key in ('overhead', 'profit', 'tax', 'discount', 'minimum', 'allowances'):
        maximum = Decimal('95') if key == 'profit' and inputs['profit_method'] == 'margin' else Decimal('100') if key in ('overhead', 'tax') or (key == 'discount' and inputs['discount_type'] == 'percent') else Decimal('1000000')
        inputs[key] = _money_string(_decimal(raw.get(key, 0), key, maximum=maximum))
    inputs['adjustment'] = _money_string(_signed_decimal(raw.get('adjustment', 0), 'adjustment'))
    n = lambda key: Decimal(inputs[key])
    direct = _money(sum((Decimal(s['subtotal']) for s in results), Decimal('0')) + n('allowances'))
    overhead = _money(direct * n('overhead') / 100)
    basis = direct + overhead
    selling = _money(basis / (1 - n('profit') / 100)) if inputs['profit_method'] == 'margin' else basis + _money(basis * n('profit') / 100)
    adjusted = max(Decimal('0'), n('minimum'), selling + n('adjustment'))
    tax = _money(adjusted * n('tax') / 100)
    subtotal = adjusted + tax
    discount = min(subtotal, _money(subtotal * n('discount') / 100) if inputs['discount_type'] == 'percent' else n('discount'))
    return inputs, {'version': 'drywall-v1', 'sections': results, 'direct_cost': _money_string(direct), 'overhead_amount': _money_string(overhead), 'tax_amount': _money_string(tax), 'subtotal': _money_string(subtotal), 'discount_amount': _money_string(discount), 'final_price': _money_string(subtotal - discount)}
