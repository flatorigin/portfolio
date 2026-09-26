from .electrical_estimators import calculate_electrical_estimate

def calculate_plumbing_estimate(raw):
    return calculate_electrical_estimate(raw, trade="plumbing")
