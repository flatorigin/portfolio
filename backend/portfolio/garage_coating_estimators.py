"""Garage coating estimates using contractor-entered complete-system rates."""
from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money_string
from .paving_estimators import choice, number, quantity, text
from .section_estimator_pricing import finalize_section_estimate


# Optional work is independently measured and priced as installed work.
EXTRAS = (
    ('preparation', 'Grinding / surface preparation', 'sq ft'),
    ('removal', 'Existing coating removal', 'sq ft'),
    ('cracks', 'Crack / joint repair', 'linear ft'),
    ('patching', 'Concrete patching', 'sq ft'),
    ('moisture', 'Moisture mitigation', 'sq ft'),
    ('flakes', 'Decorative flakes / quartz', 'sq ft'),
    ('traction', 'Slip-resistant additive', 'sq ft'),
    ('cove', 'Cove / stem-wall coating', 'linear ft'),
)


def calculate_garage_coating_estimate(raw):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 garage coating sections.'})
    normalized, results = [], []
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            raise ValidationError({'sections': 'Each section must be an object.'})
        s = {key: text(item, key, default, limit=1000 if key == 'notes' else 240)
             for key, default in {'id': str(index), 'name': 'Garage floor',
                                  'material': 'Industrial-grade polyaspartic',
                                  'product_name': '', 'system_description': '', 'notes': ''}.items()}
        if not s['name'] or not s['material']:
            raise ValidationError({'sections': 'Enter a section name and coating material.'})
        s['measurement'] = choice(item, 'measurement', ('area', 'dimensions'), 'area')
        s['pricing'] = choice(item, 'pricing', ('separate', 'installed'), 'separate')
        s['material_supplier'] = choice(item, 'material_supplier', ('contractor', 'client'), 'contractor')
        for key in ('area', 'length', 'width', 'material_rate', 'labor_rate', 'installed_rate', 'disposal'):
            s[key] = quantity(number(item, key, maximum='10000' if key in ('length', 'width') else '1000000'))
        s['waste'] = quantity(number(item, 'waste', maximum='100'))
        n = lambda key: Decimal(s[key])
        area = n('area') if s['measurement'] == 'area' else n('length') * n('width')
        if area > Decimal('1000000'):
            raise ValidationError({'area': 'Area cannot exceed 1,000,000 sq ft.'})
        purchase_area = area * (1 + n('waste') / 100) if s['pricing'] == 'separate' else area
        lines = []

        def add(name, amount, rate, unit, supplied=False):
            lines.append({'name': name, 'quantity': quantity(amount), 'rate': quantity(rate), 'unit': unit,
                          'amount': _money_string(Decimal('0') if supplied else amount * rate),
                          'customer_supplied': supplied})

        product = s['product_name'] or s['material']
        if s['pricing'] == 'installed':
            add(f'{product} — complete coating system installed', area, n('installed_rate'), 'sq ft')
        else:
            add(f'{product} — complete coating system materials', purchase_area, n('material_rate'), 'sq ft',
                s['material_supplier'] == 'client')
            add('Complete coating system application labor', area, n('labor_rate'), 'sq ft')
        for key, label, unit in EXTRAS:
            enabled = item.get(f'include_{key}', False)
            if not isinstance(enabled, bool):
                raise ValidationError({f'include_{key}': 'Expected true or false.'})
            s[f'include_{key}'] = enabled
            for suffix in ('quantity', 'rate'):
                field = f'{key}_{suffix}'
                s[field] = quantity(number(item, field))
            if enabled:
                add(f'{label} (installed)', n(f'{key}_quantity'), n(f'{key}_rate'), unit)
        add('Disposal allowance', Decimal('1'), n('disposal'), 'allowance')
        normalized.append(s)
        results.append({'name': s['name'], 'material': s['material'], 'notes': s['notes'],
                        'product_name': s['product_name'], 'system_description': s['system_description'],
                        'area': quantity(area), 'purchase_area': quantity(purchase_area),
                        'quantity_summary': f'{quantity(area)} floor sq ft; ' + (
                            'complete-system installed rate.' if s['pricing'] == 'installed' else
                            f'{quantity(purchase_area)} coating material sq ft including waste; labor excludes waste.'),
                        'line_items': lines, 'subtotal': _money_string(sum(Decimal(line['amount']) for line in lines))})
    return finalize_section_estimate(raw, normalized, results, 'garage-coating-v1')
