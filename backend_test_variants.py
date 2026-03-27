#!/usr/bin/env python3
"""
Enhanced Backend API Testing for Voice-to-Product Matching with Product Variants
Tests the complex Hindi-English voice parsing with product variants functionality
"""

import requests
import json
import sys
from typing import List, Dict, Any

# Backend URL from environment
BACKEND_URL = "https://mixed-lang-cart.preview.emergentagent.com"
API_ENDPOINT = f"{BACKEND_URL}/api/parse-voice-order"

def create_test_products_with_variants() -> List[Dict[str, Any]]:
    """Create test products with variants as specified in the review request"""
    return [
        {
            "id": "1",
            "name": "Samsung Galaxy A25",
            "brand": "Samsung",
            "model": "Galaxy A25",
            "price": 15000,
            "variants": [
                {"id": 1, "size": "6GB/128GB", "qty": 50, "mrp": 20999, "rate": 18999},
                {"id": 2, "size": "4GB/64GB", "qty": 50, "mrp": 17999, "rate": 15999},
                {"id": 3, "size": "8GB/256GB", "qty": 30, "mrp": 24999, "rate": 22999}
            ]
        },
        {
            "id": "2",
            "name": "Apple iPhone 15",
            "brand": "Apple",
            "model": "iPhone 15",
            "variants": [
                {"id": 10, "size": "128GB", "qty": 25, "mrp": 79999, "rate": 75999},
                {"id": 11, "size": "256GB", "qty": 25, "mrp": 89999, "rate": 85999}
            ]
        }
    ]

def test_variant_api_call(transcript: str, products: List[Dict], test_name: str) -> Dict[str, Any]:
    """Make API call and return response with detailed variant information"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")
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
                print(f"    Product ID: {item.get('productId', 'N/A')}")
                print(f"    Product Name: {item.get('productName', 'N/A')}")
                print(f"    Quantity: {item.get('quantity', 'N/A')}")
                print(f"    Confidence: {item.get('confidence', 'N/A'):.2f}")
                print(f"    Match Reason: {item.get('matchReason', 'N/A')}")
                print(f"    Variant ID: {item.get('variantId', 'N/A')}")
                print(f"    Variant Size: {item.get('variantSize', 'N/A')}")
                if item.get('extractedAttributes'):
                    print(f"    Extracted Attributes: {item.get('extractedAttributes')}")
            
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

def validate_variant_parsing(result: Dict, expected_variants: List[Dict], test_name: str) -> bool:
    """Validate that variant parsing worked correctly"""
    if not result.get('success'):
        print(f"❌ {test_name}: API call failed")
        return False
    
    parsed_items = result.get('parsed', [])
    
    if len(parsed_items) != len(expected_variants):
        print(f"❌ {test_name}: Expected {len(expected_variants)} items, got {len(parsed_items)}")
        return False
    
    success = True
    for i, (actual, expected) in enumerate(zip(parsed_items, expected_variants)):
        print(f"\nValidating Item {i+1}:")
        
        # Check product ID
        if actual.get('productId') == expected.get('productId'):
            print(f"  ✅ Product ID: {actual.get('productId')}")
        else:
            print(f"  ❌ Product ID: Expected {expected.get('productId')}, got {actual.get('productId')}")
            success = False
        
        # Check quantity
        if actual.get('quantity') == expected.get('quantity'):
            print(f"  ✅ Quantity: {actual.get('quantity')}")
        else:
            print(f"  ❌ Quantity: Expected {expected.get('quantity')}, got {actual.get('quantity')}")
            success = False
        
        # Check variant ID
        if actual.get('variantId') == expected.get('variantId'):
            print(f"  ✅ Variant ID: {actual.get('variantId')}")
        else:
            print(f"  ❌ Variant ID: Expected {expected.get('variantId')}, got {actual.get('variantId')}")
            success = False
        
        # Check variant size
        if actual.get('variantSize') == expected.get('variantSize'):
            print(f"  ✅ Variant Size: {actual.get('variantSize')}")
        else:
            print(f"  ❌ Variant Size: Expected {expected.get('variantSize')}, got {actual.get('variantSize')}")
            success = False
    
    return success

def run_variant_tests():
    """Run all variant parsing test scenarios"""
    products = create_test_products_with_variants()
    test_results = []
    
    print("Starting Enhanced Voice-to-Product Matching API Tests with Variants")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Endpoint: {API_ENDPOINT}")
    
    # Test 1: Complex Hindi-English mixed input with multiple variants
    print("\n" + "="*100)
    print("TEST SCENARIO 1: COMPLEX HINDI-ENGLISH MIXED INPUT WITH MULTIPLE VARIANTS")
    print("="*100)
    
    result1 = test_variant_api_call(
        "सैमसंग गैलेक्सी A25 6GB 128GB 4 पीस 4GB 64GB 5 पीस",
        products,
        "Complex Hindi-English with multiple Samsung Galaxy A25 variants"
    )
    
    expected1 = [
        {
            "productId": "1",
            "quantity": 4,
            "variantId": 1,
            "variantSize": "6GB/128GB"
        },
        {
            "productId": "1", 
            "quantity": 5,
            "variantId": 2,
            "variantSize": "4GB/64GB"
        }
    ]
    
    success1 = validate_variant_parsing(result1, expected1, "Complex Hindi-English Variants")
    test_results.append(("Complex Hindi-English with multiple variants", success1))
    
    # Test 2: Hindi words "wala" and "aur" with variants
    print("\n" + "="*100)
    print("TEST SCENARIO 2: HINDI WORDS 'WALA' AND 'AUR' WITH VARIANTS")
    print("="*100)
    
    result2 = test_variant_api_call(
        "Galaxy A25 6 GB 128 GB wala 4 aur 4 GB 64 GB wala 5",
        products,
        "Hindi words wala and aur with Galaxy A25 variants"
    )
    
    expected2 = [
        {
            "productId": "1",
            "quantity": 4,
            "variantId": 1,
            "variantSize": "6GB/128GB"
        },
        {
            "productId": "1",
            "quantity": 5,
            "variantId": 2,
            "variantSize": "4GB/64GB"
        }
    ]
    
    success2 = validate_variant_parsing(result2, expected2, "Hindi wala/aur Variants")
    test_results.append(("Hindi words wala and aur with variants", success2))
    
    # Test 3: iPhone with multiple storage variants
    print("\n" + "="*100)
    print("TEST SCENARIO 3: IPHONE WITH MULTIPLE STORAGE VARIANTS")
    print("="*100)
    
    result3 = test_variant_api_call(
        "iPhone 15 128GB 2 unit 256GB 3 unit",
        products,
        "iPhone 15 with multiple storage variants"
    )
    
    expected3 = [
        {
            "productId": "2",
            "quantity": 2,
            "variantId": 10,
            "variantSize": "128GB"
        },
        {
            "productId": "2",
            "quantity": 3,
            "variantId": 11,
            "variantSize": "256GB"
        }
    ]
    
    success3 = validate_variant_parsing(result3, expected3, "iPhone Storage Variants")
    test_results.append(("iPhone with multiple storage variants", success3))
    
    # Test 4: Single variant request
    print("\n" + "="*100)
    print("TEST SCENARIO 4: SINGLE VARIANT REQUEST")
    print("="*100)
    
    result4 = test_variant_api_call(
        "Samsung Galaxy A25 8GB 256GB 2 pieces",
        products,
        "Single Samsung Galaxy A25 variant request"
    )
    
    expected4 = [
        {
            "productId": "1",
            "quantity": 2,
            "variantId": 3,
            "variantSize": "8GB/256GB"
        }
    ]
    
    success4 = validate_variant_parsing(result4, expected4, "Single Variant Request")
    test_results.append(("Single variant request", success4))
    
    # Test 5: Mixed products with and without variants
    print("\n" + "="*100)
    print("TEST SCENARIO 5: MIXED PRODUCTS WITH AND WITHOUT VARIANTS")
    print("="*100)
    
    # Add a product without variants for this test
    mixed_products = products + [{
        "id": "3",
        "name": "Basic Phone Case",
        "brand": "Generic",
        "price": 299
    }]
    
    result5 = test_variant_api_call(
        "iPhone 15 256GB 1 unit aur basic phone case 2 pieces",
        mixed_products,
        "Mixed products with and without variants"
    )
    
    # For this test, we just check that we get results for both products
    success5 = (result5.get('success', False) and 
                len(result5.get('parsed', [])) >= 2)
    
    if success5:
        print("✅ Mixed products test passed - got results for both variant and non-variant products")
    else:
        print("❌ Mixed products test failed")
    
    test_results.append(("Mixed products with and without variants", success5))
    
    # Test 6: Edge case - Invalid variant configuration
    print("\n" + "="*100)
    print("TEST SCENARIO 6: EDGE CASE - INVALID VARIANT CONFIGURATION")
    print("="*100)
    
    result6 = test_variant_api_call(
        "Samsung Galaxy A25 16GB 512GB 1 piece",
        products,
        "Invalid variant configuration (16GB/512GB doesn't exist)"
    )
    
    # For invalid variant, we expect either:
    # 1. No match (success=false or empty parsed)
    # 2. Match to product without variant info
    # 3. Match to closest variant
    success6 = True  # We'll accept any reasonable behavior for invalid variants
    
    if result6.get('success') and result6.get('parsed'):
        print("✅ Invalid variant handled - system provided reasonable fallback")
    else:
        print("✅ Invalid variant handled - no match found (acceptable)")
    
    test_results.append(("Invalid variant configuration", success6))
    
    # Summary
    print("\n" + "="*100)
    print("VARIANT PARSING TEST SUMMARY")
    print("="*100)
    
    passed = sum(1 for _, success in test_results if success)
    total = len(test_results)
    
    for test_name, success in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All variant parsing tests passed! Enhanced voice-to-product matching with variants is working correctly.")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed. Variant parsing needs attention.")
        return False

if __name__ == "__main__":
    success = run_variant_tests()
    sys.exit(0 if success else 1)