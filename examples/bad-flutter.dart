import 'package:flutter/material.dart';

class BadFlutterWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      // Hardcoded color
      color: Color(0xFF333333),
      // Arbitrary spacing
      padding: EdgeInsets.all(13.0),
      child: Column(
        children: [
          Text(
            'Welcome',
            style: TextStyle(color: Colors.red), // Hardcoded color
          ),
          // Non-standard SizedBox height
          SizedBox(height: 17.0),
          GestureDetector(
            onTap: () {
              print('Clicked');
            },
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 11.0, vertical: 8.0),
              color: Color(0xFFFF4500), // Hardcoded color
              child: Text('Submit Action'),
            ),
          ),
          // Deep nesting example
          Container(
            child: Padding(
              padding: EdgeInsets.all(8.0),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        child: Text('Deeply nested'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
