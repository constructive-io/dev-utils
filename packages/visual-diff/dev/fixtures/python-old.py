def process_data(items):
    """Process a list of items."""
    results = []
    for item in items:
        if item > 0:
            results.append(item * 2)
    return results

class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def run(self):
        return process_data(self.data)
