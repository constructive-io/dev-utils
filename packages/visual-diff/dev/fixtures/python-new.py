from typing import List, Optional
from dataclasses import dataclass

@dataclass
class ProcessingResult:
    values: List[int]
    count: int
    total: int

def process_data(items: List[int], multiplier: int = 2) -> ProcessingResult:
    """Process a list of items with configurable multiplier."""
    results = [item * multiplier for item in items if item > 0]
    return ProcessingResult(
        values=results,
        count=len(results),
        total=sum(results)
    )

class DataProcessor:
    def __init__(self, data: List[int], multiplier: int = 2):
        self.data = data
        self.multiplier = multiplier
        self._cache: Optional[ProcessingResult] = None
    
    def run(self) -> ProcessingResult:
        if self._cache is None:
            self._cache = process_data(self.data, self.multiplier)
        return self._cache
    
    def clear_cache(self) -> None:
        self._cache = None
