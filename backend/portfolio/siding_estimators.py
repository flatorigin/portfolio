from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money_string
from .paving_estimators import choice, number, quantity, text
from .section_estimator_pricing import finalize_section_estimate


def calculate_siding_estimate(raw):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 siding sections.'})
    normalized, results = [], []
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            raise ValidationError({'sections': 'Each siding section must be an object.'})
        s = {key: text(item, key, default, limit=1000 if key == 'notes' else 240)
             for key, default in {'id': str(index), 'name': 'Exterior wall', 'material': 'Vinyl', 'product_name': '', 'notes': ''}.items()}
        if not s['name'] or not s['material']:
            raise ValidationError({'sections': 'Enter a section name and siding material.'})
        s['measurement'] = choice(item, 'measurement', ('gross', 'net', 'rectangle', 'triangle'), 'gross')
        s['pricing'] = choice(item, 'pricing', ('sqft', 'square'), 'sqft')
        s['material_supplier'] = choice(item, 'material_supplier', ('contractor', 'client'), 'contractor')
        for key, default in {'area': 0, 'width': 0, 'height': 0, 'openings': 0, 'waste': 10, 'material_rate': 0,
                             'labor_rate': 0, 'removal_area': 0, 'removal_rate': 0, 'preparation': 0, 'disposal': 0}.items():
            s[key] = quantity(number(item, key, default, maximum='100' if key == 'waste' else '1000000'))
        for key in ('remove_existing', 'removal_override'):
            if not isinstance(item.get(key, False), bool):
                raise ValidationError({key: 'Expected true or false.'})
            s[key] = item.get(key, False)
        n = lambda key: Decimal(s[key])
        measured = n('width') * n('height') if s['measurement'] in ('rectangle', 'triangle') else n('area')
        if s['measurement'] == 'triangle':
            measured /= 2
        if measured > Decimal('1000000'):
            raise ValidationError({'area': 'Section area cannot exceed 1,000,000 sq ft.'})
        openings = Decimal('0') if s['measurement'] == 'net' else n('openings')
        if openings > measured:
            raise ValidationError({'openings': 'Openings cannot exceed this section area.'})
        net = measured - openings
        purchase = net * (1 + n('waste') / 100)
        removal = (n('removal_area') if s['removal_override'] else net) if s['remove_existing'] else Decimal('0')
        if removal > net:
            raise ValidationError({'removal_area': 'Removal area cannot exceed the net siding area.'})
        lines = []

        def add(name, amount, rate, unit, supplied=False):
            lines.append({'name': name, 'quantity': quantity(amount), 'rate': quantity(rate), 'unit': unit,
                          'amount': _money_string(Decimal('0') if supplied else amount * rate), 'customer_supplied': supplied})

        product = s['product_name'] or s['material']
        add(product, purchase / 100 if s['pricing'] == 'square' else purchase, n('material_rate'),
            'square (100 sq ft)' if s['pricing'] == 'square' else 'sq ft', s['material_supplier'] == 'client')
        add('Installation labor', net, n('labor_rate'), 'sq ft')
        add('Existing siding removal', removal, n('removal_rate'), 'sq ft')
        add('Wall preparation allowance', Decimal('1'), n('preparation'), 'allowance')
        add('Disposal allowance', Decimal('1'), n('disposal'), 'allowance')
        extras = item.get('extras', [])
        if not isinstance(extras, list) or len(extras) > 50:
            raise ValidationError({'extras': 'Use up to 50 extras per section.'})
        s['extras'] = []
        for extra in extras:
            if not isinstance(extra, dict):
                raise ValidationError({'extras': 'Each extra must be an object.'})
            row = {'id': text(extra, 'id'), 'name': text(extra, 'name', 'Siding extra'),
                   'unit': choice(extra, 'unit', ('linear ft', 'sq ft', 'each', 'allowance'), 'linear ft'),
                   'quantity': quantity(number(extra, 'quantity')), 'rate': quantity(number(extra, 'rate'))}
            if not row['name']:
                raise ValidationError({'extras': 'Name each siding extra.'})
            s['extras'].append(row)
            add(row['name'], Decimal(row['quantity']), Decimal(row['rate']), row['unit'])
        normalized.append(s)
        results.append({'name': f"{s['name']} - {product}", 'material': s['material'], 'notes': s['notes'],
                        'measurement': s['measurement'], 'measured_area': quantity(measured), 'openings': quantity(openings),
                        'area': quantity(net), 'purchase_area': quantity(purchase), 'squares': quantity(purchase / 100),
                        'removal_area': quantity(removal), 'line_items': lines,
                        'subtotal': _money_string(sum(Decimal(line['amount']) for line in lines))})
    return finalize_section_estimate(raw, normalized, results, 'siding-v1')
