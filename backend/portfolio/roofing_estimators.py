from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money_string
from .section_estimator_pricing import finalize_section_estimate
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
    return finalize_section_estimate(raw, normalized, results, 'roofing-v1')
