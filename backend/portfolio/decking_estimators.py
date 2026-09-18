from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money_string
from .paving_estimators import choice, number, quantity, text
from .section_estimator_pricing import finalize_section_estimate


def calculate_decking_estimate(raw):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 deck sections.'})
    normalized, results = [], []
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            raise ValidationError({'sections': 'Each deck section must be an object.'})
        s = {key: text(item, key, default, limit=1000 if key == 'notes' else 240)
             for key, default in {'id': str(index), 'name': 'Main deck', 'material': 'Pressure-treated wood',
                                  'product_name': '', 'framing_type': 'Pressure-treated lumber', 'railing_type': 'Wood', 'notes': ''}.items()}
        if not s['name'] or not s['material']:
            raise ValidationError({'sections': 'Enter a deck name and material.'})
        s['measurement'] = choice(item, 'measurement', ('area', 'dimensions'), 'area')
        s['material_supplier'] = choice(item, 'material_supplier', ('contractor', 'client'), 'contractor')
        for key, default in {'area': 0, 'length': 0, 'width': 0, 'waste': 10, 'material_rate': 0, 'labor_rate': 0,
                             'framing_rate': 0, 'railing_length': 0, 'railing_rate': 0, 'stair_count': 0,
                             'stair_rate': 0, 'demolition_area': 0, 'demolition_rate': 0, 'disposal': 0}.items():
            value = number(item, key, default, maximum='100' if key == 'waste' else '1000000')
            if key == 'stair_count' and value != value.to_integral_value():
                raise ValidationError({key: 'Enter a whole number of stair treads.'})
            s[key] = quantity(value)
        for key in ('include_framing', 'include_railings', 'include_stairs', 'include_demolition'):
            if not isinstance(item.get(key, False), bool):
                raise ValidationError({key: 'Expected true or false.'})
            s[key] = item.get(key, False)
        n = lambda key: Decimal(s[key])
        area = n('length') * n('width') if s['measurement'] == 'dimensions' else n('area')
        if area > Decimal('1000000'):
            raise ValidationError({'area': 'Deck area cannot exceed 1,000,000 sq ft.'})
        purchase = area * (1 + n('waste') / 100)
        lines = []

        def add(name, amount, rate, unit, supplied=False):
            lines.append({'name': name, 'quantity': quantity(amount), 'rate': quantity(rate), 'unit': unit,
                          'amount': _money_string(Decimal('0') if supplied else amount * rate), 'customer_supplied': supplied})

        product = s['product_name'] or s['material']
        add(product, purchase, n('material_rate'), 'sq ft', s['material_supplier'] == 'client')
        add('Deck-board installation labor', area, n('labor_rate'), 'sq ft')
        if s['include_framing']:
            add(f"Installed framing: {s['framing_type']}", area, n('framing_rate'), 'sq ft')
        if s['include_railings']:
            add(f"Installed railing: {s['railing_type']}", n('railing_length'), n('railing_rate'), 'linear ft')
        if s['include_stairs']:
            add('Installed stair assembly (excluding railings)', n('stair_count'), n('stair_rate'), 'tread')
        if s['include_demolition']:
            add('Existing deck demolition', n('demolition_area'), n('demolition_rate'), 'sq ft')
        add('Disposal allowance', Decimal('1'), n('disposal'), 'allowance')
        extras = item.get('extras', [])
        if not isinstance(extras, list) or len(extras) > 50:
            raise ValidationError({'extras': 'Use up to 50 extras per section.'})
        s['extras'] = []
        for extra in extras:
            if not isinstance(extra, dict):
                raise ValidationError({'extras': 'Each extra must be an object.'})
            row = {'id': text(extra, 'id'), 'name': text(extra, 'name', 'Decking extra'),
                   'unit': choice(extra, 'unit', ('linear ft', 'sq ft', 'each', 'allowance'), 'each'),
                   'quantity': quantity(number(extra, 'quantity')), 'rate': quantity(number(extra, 'rate'))}
            if not row['name']:
                raise ValidationError({'extras': 'Name each decking extra.'})
            s['extras'].append(row)
            add(row['name'], Decimal(row['quantity']), Decimal(row['rate']), row['unit'])
        normalized.append(s)
        results.append({'name': f"{s['name']} - {product}", 'material': s['material'], 'notes': s['notes'],
                        'area': quantity(area), 'purchase_area': quantity(purchase), 'line_items': lines,
                        'subtotal': _money_string(sum(Decimal(line['amount']) for line in lines))})
    return finalize_section_estimate(raw, normalized, results, 'decking-v1')
