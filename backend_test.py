#!/usr/bin/env python3
"""
Backend API Testing for Voice-to-Product Matching System
Tests the intelligent voice order parsing endpoint with various scenarios
"""

import requests
import json
import sys
from typing import List, Dict, Any

# Backend URL from environment
BACKEND_URL = "https://voice-match-ai.preview.emergentagent.com"
API_ENDPOINT = f"{BACKEND_URL}/api/parse-voice-order"

def create_test_products() -> List[Dict[str, Any]]:
    """Create a comprehensive set of test products for matching"""
    return [
        {
            "id": "1",
            "name": "Close Up Toothpaste",
            "brand": "Close Up",
            "model": "Red Hot",
            "price": 45.0,
            "stock": 100,
            "attributes": {"size": "100g", "flavor": "red hot"}
        },
        {
            "id": "2", 
            "name": "Pears Soap",
            "brand": "Pears",
            "model": "Transparent",
            "price": 35.0,
            "stock": 50,
            "attributes": {"size": "75g", "type": "transparent"}
        },
        {
            "id": "3",
            "name": "Maggi Noodles",
            "brand": "Maggi",
            "model": "Masala",
            "price": 12.0,
            "stock": 200,
            "attributes": {"size": "70g", "flavor": "masala"}
        },
        {
            "id": "4",
            "name": "Parle-G Biscuits",
            "brand": "Parle",
            "model": "Glucose",
            "price": 10.0,
            "stock": 150,
            "attributes": {"size": "100g", "type": "glucose"}
        },
        {
            "id": "5",
            "name": "Colgate Strong Teeth",
            "brand": "Colgate",
            "model": "Strong Teeth",
            "price": 55.0,
            "stock": 80,
            "attributes": {"size": "200g", "type": "anticavity"}
        },
        {
            "id": "6",
            "name": "Lux Beauty Soap",
            "brand": "Lux",
            "model": "Beauty Bar",
            "price": 25.0,
            "stock": 120,
            "attributes": {"size": "100g", "fragrance": "rose"}
        },
        {
            "id": "7",
            "name": "Bournvita Health Drink",
            "brand": "Bournvita",
            "model": "Chocolate",
            "price": 180.0,
            "stock": 60,
            "attributes": {"size": "500g", "flavor": "chocolate"}
        },
        {
            "id": "8",
            "name": "Dettol Antiseptic",
            "brand": "Dettol",
            "model": "Original",
            "price": 95.0,
            "stock": 40,
            "attributes": {"size": "250ml", "type": "antiseptic"}
        },
        {
            "id": "9",
            "name": "Cotton T-Shirt",
            "brand": "Fashion Plus",
            "model": "Basic Tee",
            "price": 299.0,
            "stock": 30,
            "color": "blue",
            "attributes": {"size": "large", "color": "blue", "material": "cotton"}
        },
        {
            "id": "10",
            "name": "Cotton T-Shirt",
            "brand": "Fashion Plus", 
            "model": "Basic Tee",
            "price": 299.0,
            "stock": 25,
            "color": "red",
            "attributes": {"size": "medium", "color": "red", "material": "cotton"}
        }
    ]

def test_api_call(transcript: str, products: List[Dict], test_name: str) -> Dict[str, Any]:
    """Make API call and return response"""
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")
    print(f"Input transcript: '{transcript}'")
    
    payload = {
        "transcript": transcript,
        "products": products
    }
    
    try:
        response = requests.post(
            API_ENDPOINT,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Success: {result.get('success', False)}")
            print(f"Parsed items: {len(result.get('parsed', []))}")
            
            for i, item in enumerate(result.get('parsed', []), 1):
                print(f"  Item {i}:")
                print(f"    Product: {item.get('productName', 'N/A')}")
                print(f"    Quantity: {item.get('quantity', 'N/A')}")
                print(f"    Confidence: {item.get('confidence', 'N/A'):.2f}")
                print(f"    Match Reason: {item.get('matchReason', 'N/A')}")
                if item.get('extractedAttributes'):
                    print(f"    Attributes: {item.get('extractedAttributes')}")
            
            if result.get('unmatchedSegments'):
                print(f"Unmatched segments: {len(result.get('unmatchedSegments'))}")
                for seg in result.get('unmatchedSegments', []):
                    print(f"  - '{seg.get('text', '')}' (keywords: {seg.get('detectedKeywords', [])})")
            
            return result
        else:
            print(f"Error: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return {"success": False, "error": f"HTTP {response.status_code}"}
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return {"success": False, "error": str(e)}

def validate_fuzzy_matching(result: Dict, expected_products: List[str], test_name: str) -> bool:
    """Validate that fuzzy matching worked correctly"""
    if not result.get('success'):
        print(f"❌ {test_name}: API call failed")
        return False
    
    parsed_items = result.get('parsed', [])
    matched_products = [item.get('productName', '') for item in parsed_items]
    
    success = True
    for expected in expected_products:
        found = any(expected.lower() in product.lower() for product in matched_products)
        if found:
            print(f"✅ Found expected product: {expected}")
        else:
            print(f"❌ Missing expected product: {expected}")
            success = False
    
    return success

def validate_quantity_extraction(result: Dict, expected_quantities: List[int], test_name: str) -> bool:
    """Validate that quantity extraction worked correctly"""
    if not result.get('success'):
        print(f"❌ {test_name}: API call failed")
        return False
    
    parsed_items = result.get('parsed', [])
    actual_quantities = [item.get('quantity', 0) for item in parsed_items]
    
    if len(actual_quantities) != len(expected_quantities):
        print(f"❌ {test_name}: Expected {len(expected_quantities)} items, got {len(actual_quantities)}")
        return False
    
    success = True
    for i, (actual, expected) in enumerate(zip(actual_quantities, expected_quantities)):
        if actual == expected:
            print(f"✅ Item {i+1}: Quantity {actual} matches expected {expected}")
        else:
            print(f"❌ Item {i+1}: Quantity {actual} doesn't match expected {expected}")
            success = False
    
    return success

def validate_attribute_extraction(result: Dict, expected_attributes: List[str], test_name: str) -> bool:
    """Validate that attribute extraction worked correctly"""
    if not result.get('success'):
        print(f"❌ {test_name}: API call failed")
        return False
    
    parsed_items = result.get('parsed', [])
    
    # Check if any item has extracted attributes
    has_attributes = any(item.get('extractedAttributes') for item in parsed_items)
    
    if not has_attributes:
        print(f"❌ {test_name}: No attributes extracted")
        return False
    
    # Check for specific attributes
    all_attributes = {}
    for item in parsed_items:
        attrs = item.get('extractedAttributes', {})
        if attrs:
            all_attributes.update(attrs)
    
    success = True
    for expected_attr in expected_attributes:
        found = any(expected_attr.lower() in str(v).lower() for v in all_attributes.values())
        if found:
            print(f"✅ Found expected attribute: {expected_attr}")
        else:
            print(f"❌ Missing expected attribute: {expected_attr}")
            success = False
    
    print(f"Extracted attributes: {all_attributes}")
    return success

def run_all_tests():
    """Run all test scenarios"""
    products = create_test_products()
    test_results = []
    
    print("Starting Voice-to-Product Matching API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Endpoint: {API_ENDPOINT}")
    
    # Test 1: Fuzzy name matching
    print("\n" + "="*80)
    print("TEST SCENARIO 1: FUZZY NAME MATCHING")
    print("="*80)
    
    result1 = test_api_call(
        "closeup pasta dedo aur paras soap",
        products,
        "Fuzzy name matching (pasta->paste, paras->Pears)"
    )
    success1 = validate_fuzzy_matching(result1, ["Close Up", "Pears"], "Fuzzy Matching")
    test_results.append(("Fuzzy name matching", success1))
    
    # Test 2: Hindi quantity extraction
    print("\n" + "="*80)
    print("TEST SCENARIO 2: HINDI QUANTITY EXTRACTION")
    print("="*80)
    
    result2 = test_api_call(
        "do maggi aur teen parle g dena",
        products,
        "Hindi quantity extraction (do=2, teen=3)"
    )
    success2 = validate_quantity_extraction(result2, [2, 3], "Hindi Quantities")
    test_results.append(("Hindi quantity extraction", success2))
    
    # Test 3: English quantity extraction
    print("\n" + "="*80)
    print("TEST SCENARIO 3: ENGLISH QUANTITY EXTRACTION")
    print("="*80)
    
    result3 = test_api_call(
        "five colgate toothpaste and two lux soap",
        products,
        "English quantity extraction (five=5, two=2)"
    )
    success3 = validate_quantity_extraction(result3, [5, 2], "English Quantities")
    test_results.append(("English quantity extraction", success3))
    
    # Test 4: Attribute extraction (size/color)
    print("\n" + "="*80)
    print("TEST SCENARIO 4: ATTRIBUTE EXTRACTION")
    print("="*80)
    
    result4 = test_api_call(
        "bade size ka blue tshirt ek piece",
        products,
        "Attribute extraction (size=large, color=blue)"
    )
    success4 = validate_attribute_extraction(result4, ["large", "blue"], "Attribute Extraction")
    test_results.append(("Attribute extraction", success4))
    
    # Test 5: Mixed Hindi-English (Hinglish)
    print("\n" + "="*80)
    print("TEST SCENARIO 5: HINGLISH MIXED LANGUAGE")
    print("="*80)
    
    result5 = test_api_call(
        "mujhe ek bonvita chahiye aur do dettol bhi dena",
        products,
        "Hinglish mixed language (bonvita->Bournvita, quantities)"
    )
    success5a = validate_fuzzy_matching(result5, ["Bournvita", "Dettol"], "Hinglish Products")
    success5b = validate_quantity_extraction(result5, [1, 2], "Hinglish Quantities")
    success5 = success5a and success5b
    test_results.append(("Hinglish mixed language", success5))
    
    # Test 6: Edge case - no match
    print("\n" + "="*80)
    print("TEST SCENARIO 6: NO MATCH EDGE CASE")
    print("="*80)
    
    result6 = test_api_call(
        "some random product xyz that doesnt exist",
        products,
        "No match edge case"
    )
    
    # For no match, we expect either success=false or unmatched segments
    success6 = (not result6.get('success')) or (result6.get('unmatchedSegments') and len(result6.get('unmatchedSegments', [])) > 0)
    if success6:
        print("✅ No match case handled correctly")
    else:
        print("❌ No match case not handled properly")
    test_results.append(("No match edge case", success6))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, success in test_results if success)
    total = len(test_results)
    
    for test_name, success in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Voice-to-product matching API is working correctly.")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed. API needs attention.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)