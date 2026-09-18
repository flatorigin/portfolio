from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money, _money_string, _clean_list, _signed_decimal
from .paving_estimators import choice, number, quantity, text


def calculate_roofing_estimate(raw):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 roof sections.'})
    normalized, results = [], []
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            raise ValidationError({'sections': 'Each roof section must be an object.'})
        section = {key: text(item, key, default) for key, default in {
            'id': str(index), 'name': 'Roof section', 'material': 'Asphalt shingles', 'notes': '',
        }.items()}
        if not section['material']:
            raise ValidationError({'material': 'Enter a roofing material.'})
        section['measurement'] = choice(item, 'measurement', ('surface', 'footprint'), 'surface')
        section['material_supplier'] = choice(item, 'material_supplier', ('contractor', 'client'), 'contractor')
        for key, default in {'area': 0, 'pitch': 0, 'waste': 10, 'material_rate': 0, 'labor_rate': 0,
                             'tearoff_layers': 0, 'tearoff_rate': 0, 'disposal': 0}.items():
            maximum = '24' if key == 'pitch' else '10' if key == 'tearoff_layers' else '100' if key == 'waste' else '1000000'
            value = number(item, key, default, maximum=maximum)
            if key == 'tearoff_layers' and value != value.to_integral_value():
                raise ValidationError({key: 'Enter a whole number of existing layers.'})
            section[key] = quantity(value)
        n = lambda key: Decimal(section[key])
        # Apply slope only to horizontal footprint measurements, never measured roof area.
        factor = (1 + (n('pitch') / 12) ** 2).sqrt() if section['measurement'] == 'footprint' else Decimal('1')
        area = n('area') * factor
        purchase = area * (1 + n('waste') / 100)
        lines = []

        def add(name, amount, rate, unit, customer_supplied=False):
            lines.append({'name': name, 'quantity': quantity(amount.quantize(Decimal('0.0001'))),
                          'rate': _money_string(rate), 'unit': unit,
                          'amount': _money_string(Decimal('0') if customer_supplied else amount * rate),
                          'customer_supplied': customer_supplied})

        add(section['material'], purchase, n('material_rate'), 'sq ft', section['material_supplier'] == 'client')
        add('Installation labor', area, n('labor_rate'), 'sq ft')
        add('Tear-off labor', area * n('tearoff_layers'), n('tearoff_rate'), 'sq ft-layer')
        add('Disposal allowance', Decimal('1'), n('disposal'), 'allowance')
        extras = item.get('extras', [])
        if not isinstance(extras, list) or len(extras) > 50:
            raise ValidationError({'extras': 'Use up to 50 extras per section.'})
        section['extras'] = []
        for extra in extras:
            if not isinstance(extra, dict):
                raise ValidationError({'extras': 'Each extra must be an object.'})
            row = {key: text(extra, key, default) for key, default in {'id': '', 'name': 'Roofing extra'}.items()}
            row['unit'] = choice(extra, 'unit', ('linear ft', 'sq ft', 'each', 'allowance'), 'linear ft')
            row['quantity'] = quantity(number(extra, 'quantity'))
            row['rate'] = quantity(number(extra, 'rate'))
            if not row['name']:
                raise ValidationError({'extras': 'Name each roofing extra.'})
            section['extras'].append(row)
            add(row['name'], Decimal(row['quantity']), Decimal(row['rate']), row['unit'])
        normalized.append(section)
        results.append({'name': section['name'], 'material': section['material'], 'notes': section['notes'],
                        'measurement': section['measurement'], 'input_area': section['area'], 'pitch': section['pitch'],
                        'pitch_factor': quantity(factor.quantize(Decimal('0.0001'))),
                        'area': quantity(area.quantize(Decimal('0.01'))),
                        'roofing_squares': quantity((area / 100).quantize(Decimal('0.01'))),
                        'purchase_area': quantity(purchase.quantize(Decimal('0.01'))),
                        'line_items': lines, 'subtotal': _money_string(sum(Decimal(line['amount']) for line in lines))})
    inputs = {'sections': normalized}
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
    return inputs, {'version': 'roofing-v1', 'sections': results, 'direct_cost': _money_string(direct),
                    'overhead_amount': _money_string(overhead), 'tax_amount': _money_string(tax),
                    'subtotal': _money_string(subtotal), 'discount_amount': _money_string(discount),
                    'final_price': _money_string(subtotal - discount)}
