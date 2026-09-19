"""Quantity-based fence, window, and door estimates using shared pricing."""
from decimal import Decimal

from rest_framework.exceptions import ValidationError

from .estimators import _money_string
from .paving_estimators import choice, number, quantity, text
from .section_estimator_pricing import finalize_section_estimate


def calculate_trade_estimate(raw, category):
    if not isinstance(raw, dict):
        raise ValidationError({'inputs': 'Expected an object.'})
    sections = raw.get('sections')
    if not isinstance(sections, list) or not 1 <= len(sections) <= 50:
        raise ValidationError({'sections': 'Add 1 to 50 sections.'})
    fence = category == 'fencing'
    window = category == 'windows'
    normalized, results = [], []
    for index, item in enumerate(sections):
        if not isinstance(item, dict):
            raise ValidationError({'sections': 'Each section must be an object.'})
        defaults = {'id': str(index), 'name': 'Fence run' if fence else 'Window group' if window else 'Door group',
                    'material': 'Wood' if fence else 'Vinyl' if window else 'Wood / composite',
                    'product_name': '', 'notes': ''}
        if not fence:
            defaults['style'] = 'Double-hung' if window else 'Hinged'
        s = {key: text(item, key, default, limit=1000 if key == 'notes' else 240)
             for key, default in defaults.items()}
        if not s['name'] or not s['material']:
            raise ValidationError({'sections': 'Enter a section name and material.'})
        s['material_supplier'] = choice(item, 'material_supplier', ('contractor', 'client'), 'contractor')
        if not fence:
            s['installation'] = choice(item, 'installation', ('replacement', 'new'), 'replacement')
        if not fence and not window:
            s['location'] = choice(item, 'location', ('interior', 'exterior'), 'interior')
        keys = (('length', 'height', 'post_count', 'post_rate', 'gate_count', 'gate_rate', 'removal_length')
                if fence else ('count', 'width', 'height', 'trim_rate', 'frame_rate', 'removal_count', 'hardware_rate'))
        for key in (*keys, 'material_rate', 'labor_rate', 'removal_rate', 'disposal'):
            default = 6 if fence and key == 'height' else 0
            value = number(item, key, default)
            if key.endswith('count') and value != value.to_integral_value():
                raise ValidationError({key: 'Enter a whole-number quantity.'})
            s[key] = quantity(value)
        toggles = ('include_posts', 'include_gates', 'include_removal') if fence else ('include_trim', 'include_frame', 'include_hardware', 'include_removal')
        for key in toggles:
            if not isinstance(item.get(key, False), bool):
                raise ValidationError({key: 'Expected true or false.'})
            s[key] = item.get(key, False)
        n = lambda key: Decimal(s[key])
        lines = []

        def add(name, amount, rate, unit, supplied=False):
            lines.append({'name': name, 'quantity': quantity(amount), 'rate': quantity(rate), 'unit': unit,
                          'amount': _money_string(Decimal('0') if supplied else amount * rate), 'customer_supplied': supplied})

        product = s['product_name'] or s['material']
        base = n('length' if fence else 'count')
        unit = 'linear ft' if fence else 'window' if window else 'door'
        add(product, base, n('material_rate'), unit, s['material_supplier'] == 'client')
        add('Installation labor', base, n('labor_rate'), unit)
        if fence:
            if s['include_posts']:
                add('Posts and setting (installed)', n('post_count'), n('post_rate'), 'post')
            if s['include_gates']:
                add('Gates including hardware (installed)', n('gate_count'), n('gate_rate'), 'gate')
        else:
            for key, label in (('trim', 'Trim / finishing'), ('frame', 'Frame / opening repairs'), ('hardware', 'Additional hardware')):
                if s[f'include_{key}']:
                    add(f'{label} (installed)', base, n(f'{key}_rate'), unit)
        if s['include_removal']:
            add('Existing fence removal' if fence else 'Existing window removal' if window else 'Existing door removal',
                n('removal_length' if fence else 'removal_count'), n('removal_rate'), unit)
        add('Disposal allowance', Decimal('1'), n('disposal'), 'allowance')
        normalized.append(s)
        dimensions = f"{s['length']} linear ft at {s['height']} ft high" if fence else f"{s['count']} {category}; {s['width']} x {s['height']} in each; {s['installation']}"
        if not fence:
            dimensions += f"; {s['style']}"
            if not window:
                dimensions += f"; {s['location']}"
        results.append({'name': f"{s['name']} - {product}", 'material': s['material'], 'notes': s['notes'],
                        'quantity_summary': dimensions, 'line_items': lines,
                        'subtotal': _money_string(sum(Decimal(line['amount']) for line in lines))})
    return finalize_section_estimate(raw, normalized, results, f'{category}-v1')


def calculate_fencing_estimate(raw):
    return calculate_trade_estimate(raw, 'fencing')


def calculate_windows_estimate(raw):
    return calculate_trade_estimate(raw, 'windows')


def calculate_doors_estimate(raw):
    return calculate_trade_estimate(raw, 'doors')
