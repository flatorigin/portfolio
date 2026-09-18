from decimal import Decimal, ROUND_CEILING

from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

from .estimators import _money_string
from .paving_estimators import choice, number, quantity, text
from .section_estimator_pricing import finalize_section_estimate


def calculate_flooring_estimate(raw):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 flooring sections.'})
    normalized, results = [], []
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            raise ValidationError({'sections': 'Each flooring section must be an object.'})
        section = {key: text(item, key, default, limit=1000 if key in ('product_link', 'notes') else 240)
                   for key, default in {'id': str(index), 'name': 'Main room', 'material': 'Luxury vinyl',
                                        'product_name': '', 'brand_model': '', 'product_link': '', 'notes': ''}.items()}
        if not section['name'] or not section['material']:
            raise ValidationError({'sections': 'Enter a room name and material category.'})
        if section['product_link']:
            try:
                URLValidator(schemes=['http', 'https'])(section['product_link'])
            except DjangoValidationError:
                raise ValidationError({'product_link': 'Enter a complete http or https product URL.'})
        section['measurement'] = choice(item, 'measurement', ('area', 'dimensions'), 'area')
        section['pricing'] = choice(item, 'pricing', ('sqft', 'package'), 'sqft')
        section['material_supplier'] = choice(item, 'material_supplier', ('contractor', 'client'), 'contractor')
        for key, default in {'area': 0, 'length': 0, 'width': 0, 'waste': 10, 'material_rate': 0,
                             'coverage': 0, 'package_price': 0, 'labor_rate': 0, 'removal_rate': 0,
                             'removal_area': 0, 'preparation': 0, 'disposal': 0}.items():
            section[key] = quantity(number(item, key, default, maximum='100' if key == 'waste' else '1000000'))
        for key in ('remove_existing', 'removal_override'):
            if not isinstance(item.get(key, False), bool):
                raise ValidationError({key: 'Expected true or false.'})
            section[key] = item.get(key, False)
        n = lambda key: Decimal(section[key])
        area = n('area') if section['measurement'] == 'area' else n('length') * n('width')
        if area > Decimal('1000000'):
            raise ValidationError({'area': 'Floor area cannot exceed 1,000,000 sq ft.'})
        purchase = area * (1 + n('waste') / 100)
        packages = Decimal('0')
        if section['pricing'] == 'package':
            if purchase > 0 and n('coverage') <= 0:
                raise ValidationError({'coverage': 'Enter package coverage greater than zero.'})
            packages = (purchase / n('coverage')).to_integral_value(rounding=ROUND_CEILING) if n('coverage') else Decimal('0')
        removal = (n('removal_area') if section['removal_override'] else area) if section['remove_existing'] else Decimal('0')
        if removal > area:
            raise ValidationError({'removal_area': 'Removal area cannot exceed this section\'s floor area.'})
        lines = []

        def add(name, amount, rate, unit, supplied=False):
            lines.append({'name': name, 'quantity': quantity(amount), 'rate': quantity(rate), 'unit': unit,
                          'amount': _money_string(Decimal('0') if supplied else amount * rate), 'customer_supplied': supplied})

        product = section['product_name'] or section['material']
        supplied = section['material_supplier'] == 'client'
        if section['pricing'] == 'package':
            add(product, packages, n('package_price'), 'package', supplied)
        else:
            add(product, purchase, n('material_rate'), 'sq ft', supplied)
        add('Installation labor', area, n('labor_rate'), 'sq ft')
        add('Existing flooring removal', removal, n('removal_rate'), 'sq ft')
        add('Subfloor preparation / leveling allowance', Decimal('1'), n('preparation'), 'allowance')
        add('Disposal allowance', Decimal('1'), n('disposal'), 'allowance')
        extras = item.get('extras', [])
        if not isinstance(extras, list) or len(extras) > 50:
            raise ValidationError({'extras': 'Use up to 50 extras per section.'})
        section['extras'] = []
        for extra in extras:
            if not isinstance(extra, dict):
                raise ValidationError({'extras': 'Each extra must be an object.'})
            row = {'id': text(extra, 'id'), 'name': text(extra, 'name', 'Flooring extra'),
                   'unit': choice(extra, 'unit', ('linear ft', 'sq ft', 'each', 'step', 'allowance'), 'each'),
                   'quantity': quantity(number(extra, 'quantity')), 'rate': quantity(number(extra, 'rate'))}
            if not row['name']:
                raise ValidationError({'extras': 'Name each flooring extra.'})
            section['extras'].append(row)
            add(row['name'], Decimal(row['quantity']), Decimal(row['rate']), row['unit'])
        normalized.append(section)
        results.append({'name': f"{section['name']} - {product}", 'material': section['material'],
                        'product_name': section['product_name'], 'brand_model': section['brand_model'],
                        'product_link': section['product_link'], 'notes': section['notes'],
                        'area': quantity(area), 'purchase_area': quantity(purchase), 'packages': quantity(packages),
                        'pricing': section['pricing'], 'coverage': section['coverage'],
                        'ordered_coverage': quantity(packages * n('coverage') if section['pricing'] == 'package' else purchase),
                        'removal_area': quantity(removal), 'line_items': lines,
                        'subtotal': _money_string(sum(Decimal(line['amount']) for line in lines))})
    return finalize_section_estimate(raw, normalized, results, 'flooring-v1')
