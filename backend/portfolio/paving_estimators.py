from decimal import Decimal, ROUND_CEILING

from rest_framework.exceptions import ValidationError

from .estimators import _clean_list, _decimal, _money, _money_string, _signed_decimal


VERSION = 'paving-v1'
UNITS = {
    'skid': ('Skid / pallet', True),
    'bag': ('Bag', True),
    'ton': ('Ton', False),
    'cubic_meter': ('Cubic meter', False),
    'cubic_yard': ('Cubic yard', False),
    'square_foot': ('Square foot', False),
    'custom': ('Custom', True),
}


def quantity(value):
    return format(Decimal(value).normalize(), 'f')


def choice(raw, key, options, default, prefix=''):
    value = raw.get(key, default)
    if not isinstance(value, str) or value not in options:
        raise ValidationError({f'{prefix}{key}': 'Choose a valid option.'})
    return value


def number(raw, key, default=0, minimum='0', maximum='1000000', prefix=''):
    value = _decimal(raw.get(key, default), f'{prefix}{key}', minimum=Decimal(minimum), maximum=Decimal(maximum))
    if value != value.quantize(Decimal('0.0001')):
        raise ValidationError({f'{prefix}{key}': 'Use up to four decimal places.'})
    return value


def text(raw, key, default='', limit=240):
    value = raw.get(key, default)
    if not isinstance(value, str) or len(value) > limit:
        raise ValidationError({key: f'Enter text up to {limit} characters.'})
    return value.strip()


def calculate_section(raw, index):
    if not isinstance(raw, dict):
        raise ValidationError({'sections': 'Each paving section must be an object.'})
    prefix = f'sections.{index}.'
    section = {
        'id': text(raw, 'id', str(index), 80),
        'name': text(raw, 'name', f'Paving section {index + 1}', 120),
        'material': text(raw, 'material', 'Concrete pavers', 120),
        'notes': text(raw, 'notes', '', 1000),
        'custom_unit': text(raw, 'custom_unit', '', 60),
        'measurement': choice(raw, 'measurement', ('area', 'dimensions'), 'area', prefix),
        'unit': choice(raw, 'unit', UNITS, 'skid', prefix),
        'material_supplier': choice(raw, 'material_supplier', ('contractor', 'client'), 'contractor', prefix),
    }
    if not section['material']:
        raise ValidationError({f'{prefix}material': 'Enter a material name.'})
    if section['unit'] == 'custom' and not section['custom_unit']:
        raise ValidationError({f'{prefix}custom_unit': 'Enter the purchase unit name.'})
    for key in ('area', 'length', 'width', 'unit_price', 'labor_rate', 'preparation_rate'):
        section[key] = quantity(number(raw, key, prefix=prefix, maximum='10000' if key in ('length', 'width') else '1000000'))
    section['coverage'] = quantity(number(raw, 'coverage', 0, prefix=prefix))
    section['waste'] = quantity(number(raw, 'waste', 0, maximum='100', prefix=prefix))
    custom_whole = raw.get('whole_units', True)
    if not isinstance(custom_whole, bool):
        raise ValidationError({f'{prefix}whole_units': 'Expected true or false.'})
    section['whole_units'] = custom_whole if section['unit'] == 'custom' else UNITS[section['unit']][1]
    n = lambda key: Decimal(section[key])
    area = n('area') if section['measurement'] == 'area' else n('length') * n('width')
    if area > Decimal('1000000'):
        raise ValidationError({f'{prefix}area': 'Area cannot exceed 1,000,000 sq ft.'})
    if area > 0 and n('coverage') <= 0:
        raise ValidationError({f'{prefix}coverage': 'Enter coverage per purchase unit greater than zero.'})
    purchase_area = area * (1 + n('waste') / 100)
    raw_units = purchase_area / n('coverage') if n('coverage') > 0 else Decimal('0')
    # Round bulk orders upward to four decimal places so coverage is never short.
    units = raw_units.to_integral_value(rounding=ROUND_CEILING) if section['whole_units'] else raw_units.quantize(Decimal('0.0001'), rounding=ROUND_CEILING)
    material_cost = _money(units * n('unit_price'))
    labor_cost = _money(area * n('labor_rate'))
    preparation_cost = _money(area * n('preparation_rate'))
    charged_material = material_cost if section['material_supplier'] == 'contractor' else Decimal('0')
    unit_label = section['custom_unit'] if section['unit'] == 'custom' else UNITS[section['unit']][0]
    lines = [
        {'name': section['material'], 'quantity': quantity(units), 'unit': unit_label, 'rate': _money_string(n('unit_price')), 'amount': _money_string(charged_material), 'customer_supplied': section['material_supplier'] == 'client'},
        {'name': 'Installation labor', 'quantity': quantity(area), 'unit': 'sq ft', 'rate': _money_string(n('labor_rate')), 'amount': _money_string(labor_cost)},
        {'name': 'Site preparation', 'quantity': quantity(area), 'unit': 'sq ft', 'rate': _money_string(n('preparation_rate')), 'amount': _money_string(preparation_cost)},
    ]
    return section, {
        'section_id': section['id'], 'name': section['name'], 'material': section['material'], 'unit_label': unit_label,
        'area': quantity(area), 'purchase_area': quantity(purchase_area), 'coverage': section['coverage'],
        'ordered_units': quantity(units), 'whole_units': section['whole_units'],
        'ordered_coverage': quantity(units * n('coverage')), 'material_value': _money_string(material_cost),
        'line_items': lines, 'notes': section['notes'],
        'subtotal': _money_string(charged_material + labor_cost + preparation_cost),
    }


def calculate_paving_estimate(raw):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 paving sections.'})
    normalized, results = zip(*(calculate_section(section, index) for index, section in enumerate(sections)))
    inputs = {'sections': list(normalized)}
    for key in ('prepared_by', 'client_name', 'project_location', 'notes'):
        inputs[key] = text(raw, key, limit=2000)
    for key in ('included_scope', 'excluded_scope'):
        inputs[key] = _clean_list(raw.get(key), key)
    inputs['profit_method'] = choice(raw, 'profit_method', ('markup', 'margin'), 'markup')
    inputs['discount_type'] = choice(raw, 'discount_type', ('percent', 'fixed'), 'percent')
    inputs['output_preference'] = choice(raw, 'output_preference', ('detailed', 'summary'), 'detailed')
    for key in ('overhead', 'profit', 'tax', 'discount', 'minimum', 'allowances'):
        maximum = '95' if key == 'profit' and inputs['profit_method'] == 'margin' else '500' if key == 'profit' else '100' if key in ('overhead', 'tax') or (key == 'discount' and inputs['discount_type'] == 'percent') else '1000000'
        inputs[key] = quantity(number(raw, key, maximum=maximum))
    inputs['adjustment'] = _money_string(_signed_decimal(raw.get('adjustment', 0), 'adjustment'))
    n = lambda key: Decimal(inputs[key])
    direct = sum((Decimal(section['subtotal']) for section in results), Decimal('0')) + _money(n('allowances'))
    overhead = _money(direct * n('overhead') / 100)
    basis = direct + overhead
    selling = _money(basis / (1 - n('profit') / 100)) if inputs['profit_method'] == 'margin' else basis + _money(basis * n('profit') / 100)
    adjusted = max(Decimal('0'), _money(n('minimum')), selling + n('adjustment'))
    tax = _money(adjusted * n('tax') / 100)
    subtotal = adjusted + tax
    discount = min(subtotal, _money(subtotal * n('discount') / 100) if inputs['discount_type'] == 'percent' else _money(n('discount')))
    if max(direct, subtotal) > Decimal('9999999999.99'):
        raise ValidationError({'inputs': 'Estimate exceeds the supported price limit.'})
    return inputs, {
        'version': VERSION, 'sections': list(results), 'direct_cost': _money_string(direct),
        'overhead_amount': _money_string(overhead), 'profit_amount': _money_string(selling - basis),
        'minimum_adjustment': _money_string(max(Decimal('0'), adjusted - selling - n('adjustment'))),
        'tax_amount': _money_string(tax), 'subtotal': _money_string(subtotal),
        'discount_amount': _money_string(discount), 'final_price': _money_string(subtotal - discount),
    }
